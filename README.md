# flomo2Anki脚本基本介绍

## 特点

### 卡片案例

- flomo卡片![Pasted image 20250208204428](https://springrain-picturebed.oss-cn-shenzhen.aliyuncs.com/img/Pasted%20image%2020250208204428.png)

- Anki卡片![image-20250302232052202](https://springrain-picturebed.oss-cn-shenzhen.aliyuncs.com/img/image-20250302232052202.png)

### 基本格式

- 支持flomo卡片中的所有富文本样式、@引用（内部链接）、外部链接、图片（以图床形式不占用Anki同步资源）

### 链接处理

- 引用（内部链接）：点击链接后，将自动跳转至flomo网页引用详情界面
- 图床链接：将flomo卡片中的缩略图链接改为原图链接
- 外部链接：点击链接后，将自动跳转至原始网页
- 卡片源链接：在Anki卡片尾部自动附录flomo卡片源链接，点击链接后，将自动跳转至flomo网页笔记详情界面，（1）查看相关笔记，与已知建立联系；（2）查看随机漫步，以图谱视角漫游式复习![Pasted image 20250208205641](https://springrain-picturebed.oss-cn-shenzhen.aliyuncs.com/img/Pasted%20image%2020250208205641.png)

### 标签转义

- flomo中的标签同步至Anki卡片中的标签栏，并在正文中删除，多级标签中间的“/”处理为“::”，便于Anki的【Schema Weaver - XXHK】(1564281814)插件将碎片化的卡片结构化。如在flomo中”#上级/下级“标签将转义为“上级::下级”的Anki标签，复习界面的两侧就会显示相关的知识体系，左侧会显示“上级”的所有“下级”，右侧会显示“下级”的所有笔记

### 卡片模板

- 问答卡片（basic）

  - 自动将带有“#AK问答”的标签卡片转化为问答卡片，剔除标签后的第一行为问题字段（支持标签与问题在一行、标签在首行而问题在下一行），后面的为答案字段
- 划线卡片（cloze）

  - 自动将带有“#AK划线”的标签卡片转化为划线卡片的引用字段，flomo下划线格式内容模板自动识别为cloze

### 更新处理

- 自动查询Anki中是否有内容相同的源链接字段“Source”，如果存在则更新现有卡片所有字段（问题、答案、标签、引用）
- 无“#AK问答”、“#AK划线”的标签卡片，自动按配置区默认模板处理

### 转发处理

- 支持单张flomo卡片发送：右上角单击「2Anki」按钮
- 支持多张flomo卡片批量发送：单张卡片右上角勾选复选框或者点击网页右下角「全选」（全选后，网页往下划loading加载卡片时也能自动勾选），点击网页右下角「批量发送到Anki」

### 配置区UI化

![image-20250302155925387](https://springrain-picturebed.oss-cn-shenzhen.aliyuncs.com/img/image-20250302155925387.png)

- 可修改自定义牌组名称、默认模板和按钮样式等![image-20250302231820433](https://springrain-picturebed.oss-cn-shenzhen.aliyuncs.com/img/image-20250302231820433.png)
- 可进行图片处理，因为flomo网站上的图床链接是有防盗链机制的（有效期内可访问），通过下载上传到私有第三方图床就可以长久访问，建议用PicGo批量上传下载的图片，当勾选迁移至私有第三方图床，配置好相关信息后，会自动修改发送Anki中的图床链接![image-20250302160443712](https://springrain-picturebed.oss-cn-shenzhen.aliyuncs.com/img/image-20250302160443712.png)
- 批量下载网页中的原始图片，flomo卡片中显示的是缩略图，这里进行了处理为原图下载，若卡片图片较多时，为避免一个个另存为窗口，可以在浏览器中进行如下设置：![image-20250302161731717](https://springrain-picturebed.oss-cn-shenzhen.aliyuncs.com/img/image-20250302161731717.png)

## 使用说明

### Step1. 安装 篡改猴 (Tampermonkey)  浏览器扩展，添加flomo2Anki脚本（复制js文件内容）

### Step2. 安装 Anki 并启用 Ankiconnect (2055492159)插件，导入flomo2Anki模板

### Step3. 保持 Anki 在后台运行，打开flomo网页进行操作

## 作者|Springrain，20250302

![及时春雨up赞赏码](https://springrain-picturebed.oss-cn-shenzhen.aliyuncs.com/img/%E5%8F%8A%E6%97%B6%E6%98%A5%E9%9B%A8up%E8%B5%9E%E8%B5%8F%E7%A0%81.jpg)

