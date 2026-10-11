import Foundation
@preconcurrency import Speech
@preconcurrency import AVFoundation

func emit(_ value: [String: Any]) {
 if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) {
  FileHandle.standardOutput.write(data); FileHandle.standardOutput.write(Data([10]))
 }
}
@main struct LocalSpeech {
 static func main() async {
  do {
   guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: "zh-CN")) else {
    emit(["type":"error", "message":"这台主机暂不支持本地中文语音识别。"]); return
   }
   let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [.volatileResults, .fastResults], attributeOptions: [])
   let installed = await SpeechTranscriber.installedLocales.contains { $0.identifier == locale.identifier }
   if CommandLine.arguments.contains("--check") { emit(["type":"status", "available":installed, "locale":locale.identifier]); return }
   guard installed else { emit(["type":"error", "message":"请先在 macOS 下载中文语音模型。"]); return }
   let rate = CommandLine.arguments.dropFirst().first.flatMap(Double.init) ?? 16000
   guard let inputFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: rate, channels: 1, interleaved: false),
         let targetFormat = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]),
         let converter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
    emit(["type":"error", "message":"无法初始化音频格式。"]); return
   }
   let analyzer = SpeechAnalyzer(modules: [transcriber])
   try await analyzer.prepareToAnalyze(in: targetFormat)
   let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
   let results = Task {
    for try await result in transcriber.results {
     emit(["type":"transcript", "text":String(result.text.characters), "final":result.isFinal])
    }
   }
   try await analyzer.start(inputSequence: stream)
   emit(["type":"ready", "sampleRate":rate])
   // Browser supplies mono Float32 PCM. No microphone or audio file is opened here.
   let reader = Task.detached {
    var pending = Data()
    var silentFrames = 0
    var hasSpeech = false
    var outputFrames: Int64 = 0
    while let chunk = try FileHandle.standardInput.read(upToCount: 8192), !chunk.isEmpty {
     pending.append(chunk)
     let count = pending.count / 4
     if count == 0 { continue }
     let input = AVAudioPCMBuffer(pcmFormat: inputFormat, frameCapacity: AVAudioFrameCount(count))!
     input.frameLength = AVAudioFrameCount(count)
     _ = pending.withUnsafeBytes { raw in memcpy(input.floatChannelData![0], raw.baseAddress!, count * 4) }
     pending.removeFirst(count * 4)
     var energy: Float = 0
     for index in 0..<count { let value = input.floatChannelData![0][index]; energy += value * value }
     if sqrt(energy / Float(count)) > 0.008 { hasSpeech = true; silentFrames = 0 } else { silentFrames += count }
     let capacity = AVAudioFrameCount(ceil(Double(count) * targetFormat.sampleRate / rate)) + 32
     let output = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity)!
     var supplied = false
     var error: NSError?
     converter.convert(to: output, error: &error) { _, status in
      if supplied { status.pointee = .noDataNow; return nil }
      supplied = true; status.pointee = .haveData; return input
     }
     if let error { throw error }
     if output.frameLength > 0 {
      outputFrames += Int64(output.frameLength)
      continuation.yield(AnalyzerInput(buffer: output))
     }
     // Commit recognition after a natural pause; this is not a periodic send.
     // The web sentence buffer still waits for finalized terminal punctuation.
     if hasSpeech && Double(silentFrames) / rate >= 1.2 {
      hasSpeech = false
      let boundary = CMTime(value: outputFrames, timescale: Int32(targetFormat.sampleRate))
      // Finalization can await future decoder context. Keep feeding silence
      // and subsequent speech while that request is pending.
      Task { try await analyzer.finalize(through: boundary) }
     }
    }
    continuation.finish()
   }
   try await reader.value
   try await analyzer.finalizeAndFinishThroughEndOfInput()
   try await results.value
   emit(["type":"stopped"])
  } catch {
   emit(["type":"error", "message":"本地语音识别中断，请停止后重新开始。"])
  }
 }
}
