# 津门白描九人图集 v1

内置 image_gen 生成；未使用 CLI；原图未做脚本修改。

尺寸：1536 × 1024，RGBA。检查背景 alpha 为 0，人物内部 alpha 约为 250–254。某些预览器会显示透明区域的隐藏黑灰 RGB，浏览器按 alpha 显示即可，无须 multiply 或抠图。

图集顺序：梁启超、李鸿章、严复 / 李叔同、蔡元培、柏拉图 / 达芬奇、伽利略、愚公。

人物像素边界与手工估计双眼坐标见同名 JSON。bbox 为 [left, top, right, bottom]，右/下边界不包含；eyes 和 head 坐标相对 bbox 左上角。眼睛位置仅供轻量动作初值，接入时应做视觉微调。达芬奇帽顶从 y=682 开始，比 3×3 等分第三行上边界提前 1px，应采用给出的 bbox。九人可见高度约 322–333px，不宜放大作全屏特写。此图集为听讲站姿，不含真正逐帧走路/转头动作。

## 生成提示词

Use case: historical-scene
Asset type: 3 by 3 character sprite sheet for a theatrical web stage. This is a production game asset, not a poster or scene. Landscape sheet in a 3:2 aspect ratio, ideally 1536 x 1024.
Input reference: attached image for fine gray-black Chinese baimiao contour drawing style only. Do not copy its composition, buildings, text, labels or speech bubbles.
Draw exactly NINE distinct historical full-body standing men. Strict evenly divided THREE columns and THREE rows, one person per cell. All heads and feet entirely inside their cell with ample clear margins. Each cell's full body scale equal and grounded at the same local baseline. Each individual in a relaxed listening stance, slight three-quarter front pose, natural proportions, detailed face and hands, not cartoon or stickman.
Exact order from left to right:
TOP ROW: 1 Liang Qichao 梁启超, energetic clean-shaven Chinese gentleman circa 1910–1920 in Western long suit coat, waistcoat and trousers, short hair, composed stance. 2 Li Hongzhang 李鸿章, elderly late-Qing statesman in long Mandarin robe and round official hat, long thin beard and moustache, dignified. 3 Yan Fu 严复, older Chinese intellectual with round glasses and moustache wearing traditional long gown, holding closed book.
MIDDLE ROW: 4 Li Shutong 李叔同 as Hongyi 弘一, slim shaved-head Buddhist monk in loose plain robes, gentle face, hands resting together. 5 Cai Yuanpei 蔡元培, middle-aged Chinese scholar with round spectacles, moustache and neat short hair, traditional changshan, book in one hand. 6 Plato 柏拉图, classical Greek philosopher with short curly hair and full curly beard, draped long toga, small scroll.
BOTTOM ROW: 7 Leonardo da Vinci 达芬奇, elderly European with long wavy hair and full beard under Renaissance soft cap, tunic and long coat, holding sketchbook. 8 Galileo 伽利略, elderly European bald crown with hair at sides and full beard, long scholarly Renaissance robe, carrying short telescope. 9 Yugong 愚公, elderly Chinese laborer with head scarf, plain rolled-sleeve work tunic and baggy trousers, sturdy cloth shoes, carrying a modest wooden hoe on shoulder completely within his cell.
Style: refined thin dark gray pen/woodblock engraved linework, pale paper white OPAQUE clothing and skin interiors, delicate expressive features, economical hatching. Match the antique Chinese fine-line illustrated reference. Mostly light paper silhouettes, only small accents of black at hair or shoes. No colored clothing.
Background: genuinely transparent alpha outside all nine figures; opaque off-white within each silhouette so buildings cannot show through clothes. If unable to make alpha, use absolutely pure solid white around them, no paper texture outside.
Constraints: EXACTLY 9 figures, full bodies, NEVER crop feet/head/tools. Keep them within equal 3x3 cells. No touching or overlap. Absolutely no labels, numbers, names, lettering, captions, grid lines, border, scenery, backgrounds, floor lines, shadows, bubbles or decorative motifs. No text anywhere.
