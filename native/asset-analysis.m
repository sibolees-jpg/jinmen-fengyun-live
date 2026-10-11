#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <CoreImage/CoreImage.h>
#import <ImageIO/ImageIO.h>
#import <CoreGraphics/CoreGraphics.h>
// Transparent artwork keeps its alpha. Bright line drawings use edge-connected
// background removal, preserving white clothing enclosed by the ink outline.
static BOOL artworkMask(CIImage *image, size_t width, size_t height, const char *output){
 size_t n=width*height;unsigned char *src=calloc(n,4),*mask=calloc(n,1),*wall=calloc(n,1),*seen=calloc(n,1);uint32_t *queue=calloc(n,sizeof(uint32_t));
 CIContext *ctx=[CIContext contextWithOptions:@{kCIContextUseSoftwareRenderer:@YES}];CGColorSpaceRef cs=CGColorSpaceCreateDeviceRGB();[ctx render:image toBitmap:src rowBytes:width*4 bounds:CGRectMake(0,0,width,height) format:kCIFormatRGBA8 colorSpace:cs];
 size_t transparent=0,bright=0,border=0;for(size_t y=0;y<height;y++)for(size_t x=0;x<width;x++){size_t p=y*width+x;unsigned char *c=src+4*p;if(c[3]<128)transparent++;if(x<8||y<8||x+8>=width||y+8>=height){border++;if(c[0]>218&&c[1]>218&&c[2]>218)bright++;}}
 const char *method=NULL;
 if(transparent>n/50){method="source-alpha";for(size_t p=0;p<n;p++)mask[p]=src[p*4+3];}
 else if(bright>border*.97){method="line-art-background";int radius=MAX(1,MIN(width,height)/700);for(size_t y=0;y<height;y++)for(size_t x=0;x<width;x++){unsigned char *c=src+4*(y*width+x);if(MIN(c[0],MIN(c[1],c[2]))<210){for(int dy=-radius;dy<=radius;dy++)for(int dx=-radius;dx<=radius;dx++){long xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<width&&yy<height)wall[yy*width+xx]=1;}}}
 size_t head=0,tail=0;for(size_t p=0;p<n;p++){size_t x=p%width,y=p/width;if((x==0||y==0||x+1==width||y+1==height)&&!wall[p]&&!seen[p]){seen[p]=1;queue[tail++]=(uint32_t)p;}}
 while(head<tail){size_t p=queue[head++],x=p%width,y=p/width;size_t q[4]={x?p-1:p,x+1<width?p+1:p,y?p-width:p,y+1<height?p+width:p};for(int k=0;k<4;k++)if(!wall[q[k]]&&!seen[q[k]]){seen[q[k]]=1;queue[tail++]=(uint32_t)q[k];}}
 for(size_t y=0;y<height;y++)for(size_t x=0;x<width;x++){size_t p=y*width+x;if(seen[p])continue;BOOL near=NO;for(int dy=-radius;dy<=radius&&!near;dy++)for(int dx=-radius;dx<=radius;dx++){long xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<width&&yy<height&&seen[yy*width+xx]){near=YES;break;}}mask[p]=near?0:255;}
 }
 BOOL ok=NO;if(method){size_t count=0,x0=width,y0=height,x1=0,y1=0;for(size_t p=0;p<n;p++){if(mask[p]>64){count++;size_t x=p%width,y=p/width;x0=MIN(x0,x);x1=MAX(x1,x+1);y0=MIN(y0,y);y1=MAX(y1,y+1);}for(int k=0;k<4;k++)src[4*p+k]=mask[p];}double coverage=(double)count/n;if(coverage>.03&&coverage<.95){CGContextRef cg=CGBitmapContextCreate(src,width,height,8,width*4,cs,kCGImageAlphaPremultipliedLast);CGImageRef out=CGBitmapContextCreateImage(cg);CGImageDestinationRef dest=CGImageDestinationCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:@(output)],CFSTR("public.png"),1,NULL);CGImageDestinationAddImage(dest,out,NULL);ok=CGImageDestinationFinalize(dest);CFRelease(dest);CGImageRelease(out);CGContextRelease(cg);if(ok)printf("{\"width\":%zu,\"height\":%zu,\"coverage\":%.4f,\"review\":true,\"method\":\"%s\",\"contentBounds\":[%.6f,%.6f,%.6f,%.6f]}\n",width,height,coverage,method,(double)x0/width,(double)y0/height,(double)x1/width,(double)y1/height);}}
 CGColorSpaceRelease(cs);free(src);free(mask);free(wall);free(seen);free(queue);return ok;
}

int main(int argc,const char*argv[]){@autoreleasepool{
 if(argc<4)return 2;NSURL *url=[NSURL fileURLWithPath:@(argv[1])];CIImage *image=[CIImage imageWithContentsOfURL:url];if(!image)return 3;
 size_t width=image.extent.size.width,height=image.extent.size.height;if(!width||!height||width*height>40000000)return 4;
 if(!strcmp(argv[3],"background")){printf("{\"width\":%zu,\"height\":%zu,\"review\":true,\"method\":\"geometry\"}\n",width,height);return 0;}
 if(artworkMask(image,width,height,argv[2]))return 0;
 VNGeneratePersonSegmentationRequest *request=[VNGeneratePersonSegmentationRequest new];request.usesCPUOnly=YES;request.qualityLevel=VNGeneratePersonSegmentationRequestQualityLevelAccurate;request.outputPixelFormat=kCVPixelFormatType_OneComponent8;
 NSError *err=nil;VNImageRequestHandler *handler=[[VNImageRequestHandler alloc] initWithCIImage:image options:@{}];if(![handler performRequests:@[request] error:&err])return 5;
 VNPixelBufferObservation *observation=request.results.firstObject;if(!observation)return 6;
 CIImage *mask=[CIImage imageWithCVPixelBuffer:observation.pixelBuffer];mask=[mask imageByApplyingTransform:CGAffineTransformMakeScale(width/mask.extent.size.width,height/mask.extent.size.height)];
 CIContext *context=[CIContext contextWithOptions:@{kCIContextUseSoftwareRenderer:@YES}];unsigned char *gray=calloc(width*height,1),*rgba=calloc(width*height,4);CGColorSpaceRef graySpace=CGColorSpaceCreateDeviceGray();[context render:mask toBitmap:gray rowBytes:width bounds:CGRectMake(0,0,width,height) format:kCIFormatL8 colorSpace:graySpace];CGColorSpaceRelease(graySpace);
 size_t count=0;for(size_t i=0;i<width*height;i++){float a=fmaxf(0,fminf(1,(gray[i]/255.0f-.86f)/.12f));unsigned char v=a*255;rgba[i*4]=v;rgba[i*4+1]=v;rgba[i*4+2]=v;rgba[i*4+3]=v;if(v>128)count++;}free(gray);
 double coverage=(double)count/(width*height);if(coverage<.04||coverage>.95){free(rgba);return 7;}
 CGColorSpaceRef cs=CGColorSpaceCreateDeviceRGB();CGContextRef cg=CGBitmapContextCreate(rgba,width,height,8,width*4,cs,kCGImageAlphaPremultipliedLast);CGImageRef out=CGBitmapContextCreateImage(cg);CGImageDestinationRef destination=CGImageDestinationCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:@(argv[2])],CFSTR("public.png"),1,NULL);CGImageDestinationAddImage(destination,out,NULL);BOOL ok=CGImageDestinationFinalize(destination);CFRelease(destination);CGImageRelease(out);CGContextRelease(cg);CGColorSpaceRelease(cs);free(rgba);if(!ok)return 8;
 printf("{\"width\":%zu,\"height\":%zu,\"coverage\":%.4f,\"review\":true,\"method\":\"person-segmentation\"}\n",width,height,coverage);return 0;
}}
