// ==UserScript==
// @name         flomo2Anki
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  将 flomo 笔记发送到 Anki，支持单张和批量发送，并处理标签和时间链接
// @author       springrain
// @match        https://v.flomoapp.com/mine*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @connect      localhost
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// ==/UserScript==


(function () {
    'use strict';

    // 创建配置管理类
    class Config {
        constructor() {
            // 默认配置
            this.defaultConfig = {
                ankiconnectUrl: 'http://localhost:8765',
                defaultDeck: 'flomo',
                defaultModel: '划线卡片',
                fieldMapping: {
                    '划线卡片': {
                        Front: '引用',
                        Back: '引用',
                    },
                    '问答卡片': {
                        Front: '问题',
                        Back: '答案',
                    },
                },
                buttonStyle: {
                    marginLeft: '10px',
                    padding: '5px 10px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                },
                checkboxStyle: {
                    marginLeft: '10px',
                    cursor: 'pointer',
                },
                // 图片处理配置
                downloadImages: false,
                migrateToOSS: false,
                // 第三方图床配置
                aliyunOSS: {
                    bucket: 'springrain-picturebed',
                    region: 'oss-cn-shenzhen',
                    folder: 'img/',
                    endpoint: 'oss-cn-shenzhen.aliyuncs.com',
                    saveWithoutDialog: false
                }
            };

            // 从存储加载配置
            this.loadConfig();
        }

        // 加载配置
        loadConfig() {
            try {
                const savedConfig = GM_getValue('flomo2anki_config');
                if (savedConfig) {
                    // 将保存的配置与默认配置深度合并
                    const parsedConfig = JSON.parse(savedConfig);
                    this.config = this.mergeDeep(this.defaultConfig, parsedConfig);
                } else {
                    this.config = JSON.parse(JSON.stringify(this.defaultConfig)); // 深拷贝默认配置
                }
            } catch (e) {
                console.error('加载配置失败:', e);
                this.config = JSON.parse(JSON.stringify(this.defaultConfig)); // 出错时使用默认配置
            }
            return this.config;
        }

        // 深度合并对象方法
        mergeDeep(target, source) {
            const isObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);

            // 创建目标对象的副本
            const output = Object.assign({}, target);

            if (isObject(target) && isObject(source)) {
                Object.keys(source).forEach(key => {
                    if (isObject(source[key])) {
                        if (!(key in target)) {
                            // 如果目标中不存在该键，直接复制源
                            output[key] = source[key];
                        } else {
                            // 如果目标中存在该键且是对象，递归合并
                            output[key] = this.mergeDeep(target[key], source[key]);
                        }
                    } else {
                        // 源属性不是对象，直接覆盖
                        output[key] = source[key];
                    }
                });
            }

            return output;
        }

        // 保存配置
        saveConfig() {
            GM_setValue('flomo2anki_config', JSON.stringify(this.config));
        }

        // 显示配置对话框
        showConfigDialog() {
            // 创建对话框容器
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 0 10px rgba(0,0,0,0.3);
                z-index: 10000;
                width: 500px;
                max-width: 90vw;
                max-height: 90vh;
                overflow-y: auto;
            `;

            // 对话框标题
            const title = document.createElement('h3');
            title.textContent = 'flomo2Anki 配置';
            title.style.marginTop = '0';

            // 创建表单
            const form = document.createElement('div');

            // 基本设置区域
            let formHtml = `
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">AnkiConnect 地址：</label>
                    <input id="ankiconnect-url" type="text" value="${this.config.ankiconnectUrl}" style="width: 100%; padding: 5px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">默认牌组：</label>
                    <input id="default-deck" type="text" value="${this.config.defaultDeck}" style="width: 100%; padding: 5px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">默认模板：</label>
                    <select id="default-model" style="width: 100%; padding: 5px;">
            `;

            // 添加现有模板到选择器
            const models = Object.keys(this.config.fieldMapping);
            models.forEach(model => {
                formHtml += `<option value="${model}" ${this.config.defaultModel === model ? 'selected' : ''}>${model}</option>`;
            });

            formHtml += `
                    </select>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">模板字段映射：</label>
                    <div id="field-mappings">
            `;

            // 为每个模板创建字段映射区域
            models.forEach(model => {
                formHtml += `
                    <div class="model-mapping" data-model="${model}" style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; ${this.config.defaultModel === model ? '' : 'display: none;'}">
                        <h4 style="margin-top: 0;">${model}</h4>
                        <div style="display: flex; margin-bottom: 5px;">
                            <label style="width: 80px;">Front 字段:</label>
                            <input id="mapping-${model}-front" type="text" value="${this.config.fieldMapping[model].Front}" style="flex: 1; padding: 5px;">
                        </div>
                        <div style="display: flex;">
                            <label style="width: 80px;">Back 字段:</label>
                            <input id="mapping-${model}-back" type="text" value="${this.config.fieldMapping[model].Back}" style="flex: 1; padding: 5px;">
                        </div>
                    </div>
                `;
            });

            formHtml += `
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">图片处理：</label>
                    <div style="display: flex; margin-bottom: 5px; align-items: center;">
                        <input id="download-images" type="checkbox" ${this.config.downloadImages ? 'checked' : ''}>
                        <label for="download-images" style="margin-left: 5px;">批量下载网页中的原始图片</label>
                    </div>
                    <div style="display: flex; margin-bottom: 5px; align-items: center;">
                        <input id="migrate-to-oss" type="checkbox" ${this.config.migrateToOSS ? 'checked' : ''}>
                        <label for="migrate-to-oss" style="margin-left: 5px;">迁移至私有第三方图床（可将下载的图片用PicGo批量上传）</label>
                    </div>
                </div>

                <div id="oss-settings" style="margin-bottom: 15px; ${this.config.migrateToOSS ? '' : 'display: none;'}">
                    <label style="display: block; margin-bottom: 5px;">第三方图床设置：</label>
                    <div style="display: flex; margin-bottom: 5px;">
                        <label style="width: 120px;">Bucket:</label>
                        <input id="oss-bucket" type="text" value="${this.config.aliyunOSS.bucket}" style="flex: 1; padding: 5px;">
                    </div>
                    <div style="display: flex; margin-bottom: 5px;">
                        <label style="width: 120px;">Region:</label>
                        <input id="oss-region" type="text" value="${this.config.aliyunOSS.region}" style="flex: 1; padding: 5px;">
                    </div>
                    <div style="display: flex; margin-bottom: 5px;">
                        <label style="width: 120px;">Folder:</label>
                        <input id="oss-folder" type="text" value="${this.config.aliyunOSS.folder}" style="flex: 1; padding: 5px;">
                    </div>
                    <div style="display: flex; margin-bottom: 5px;">
                        <label style="width: 120px;">Endpoint:</label>
                        <input id="oss-endpoint" type="text" value="${this.config.aliyunOSS.endpoint}" style="flex: 1; padding: 5px;">
                    </div>
                    <div style="display: flex; margin-bottom: 5px; align-items: center;">
                        <input id="save-without-dialog" type="checkbox" ${this.config.aliyunOSS.saveWithoutDialog ? 'checked' : ''}>
                        <label for="save-without-dialog" style="margin-left: 5px;">自动保存图片（无弹窗）</label>
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">按钮样式：</label>
                    <div style="display: flex; margin-bottom: 5px;">
                        <label style="width: 120px;">背景颜色:</label>
                        <input id="button-bg-color" type="color" value="${this.config.buttonStyle.backgroundColor}" style="width: 50px; height: 30px;">
                    </div>
                    <div style="display: flex; margin-bottom: 5px;">
                        <label style="width: 120px;">文字颜色:</label>
                        <input id="button-text-color" type="color" value="${this.config.buttonStyle.color}" style="width: 50px; height: 30px;">
                    </div>
                    <div style="display: flex; margin-bottom: 5px;">
                        <label style="width: 120px;">边框圆角:</label>
                        <input id="button-border-radius" type="number" value="${parseInt(this.config.buttonStyle.borderRadius)}" min="0" max="20" style="width: 60px; padding: 5px;">px
                    </div>
                </div>
            `;

            form.innerHTML = formHtml;

            // 按钮区域
            const buttons = document.createElement('div');
            buttons.style.textAlign = 'right';
            buttons.style.marginTop = '20px';

            // 重置按钮
            const resetBtn = document.createElement('button');
            resetBtn.textContent = '恢复默认';
            resetBtn.style.cssText = 'padding: 5px 15px; margin-right: 10px; cursor: pointer;';
            resetBtn.onclick = () => {
                if (confirm('确定要重置所有配置到默认值吗？')) {
                    this.config = JSON.parse(JSON.stringify(this.defaultConfig)); // 深拷贝
                    this.saveConfig();
                    document.body.removeChild(dialog);
                    Swal.fire('成功', '已恢复默认配置', 'success');
                    setTimeout(() => location.reload(), 1500);
                }
            };

            // 取消按钮
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = 'padding: 5px 15px; margin-right: 10px; cursor: pointer;';
            cancelBtn.onclick = () => document.body.removeChild(dialog);

            // 保存按钮
            const saveBtn = document.createElement('button');
            saveBtn.textContent = '保存';
            saveBtn.style.cssText = 'padding: 5px 15px; background: #4CAF50; color: white; border: none; cursor: pointer;';
            saveBtn.onclick = () => {
                // 获取基本配置
                this.config.ankiconnectUrl = document.getElementById('ankiconnect-url').value;
                this.config.defaultDeck = document.getElementById('default-deck').value;
                this.config.defaultModel = document.getElementById('default-model').value;

                // 获取所有模板的字段映射
                const modelMappings = document.querySelectorAll('.model-mapping');
                modelMappings.forEach(mapping => {
                    const model = mapping.dataset.model;
                    const frontField = document.getElementById(`mapping-${model}-front`).value;
                    const backField = document.getElementById(`mapping-${model}-back`).value;

                    // 确保该模板存在于配置中
                    if (!this.config.fieldMapping[model]) {
                        this.config.fieldMapping[model] = {};
                    }

                    this.config.fieldMapping[model].Front = frontField;
                    this.config.fieldMapping[model].Back = backField;
                });

                // 图片处理设置
                this.config.downloadImages = document.getElementById('download-images').checked;
                this.config.migrateToOSS = document.getElementById('migrate-to-oss').checked;

                // 第三方图床设置
                this.config.aliyunOSS = {
                    bucket: document.getElementById('oss-bucket').value,
                    region: document.getElementById('oss-region').value,
                    folder: document.getElementById('oss-folder').value,
                    endpoint: document.getElementById('oss-endpoint').value,
                    saveWithoutDialog: document.getElementById('save-without-dialog').checked
                };

                // 按钮样式
                this.config.buttonStyle.backgroundColor = document.getElementById('button-bg-color').value;
                this.config.buttonStyle.color = document.getElementById('button-text-color').value;
                this.config.buttonStyle.borderRadius = document.getElementById('button-border-radius').value + 'px';

                // 保存配置
                this.saveConfig();

                // 提示用户
                document.body.removeChild(dialog);
                Swal.fire('成功', '配置已保存', 'success');

                // 刷新页面应用新配置
                setTimeout(() => location.reload(), 1500);
            };

            // 组装对话框
            buttons.appendChild(resetBtn);
            buttons.appendChild(cancelBtn);
            buttons.appendChild(saveBtn);
            dialog.appendChild(title);
            dialog.appendChild(form);
            dialog.appendChild(buttons);
            document.body.appendChild(dialog);

            // 添加事件监听器，以在更改默认模板时显示对应的字段映射
            document.getElementById('default-model').addEventListener('change', function() {
                const selectedModel = this.value;
                document.querySelectorAll('.model-mapping').forEach(mapping => {
                    mapping.style.display = mapping.dataset.model === selectedModel ? 'block' : 'none';
                });
            });

            // 添加 OSS 设置显示/隐藏逻辑
            form.querySelector('#migrate-to-oss').addEventListener('change', function() {
                document.getElementById('oss-settings').style.display = this.checked ? 'block' : 'none';
            });
        }
    }

    // 实例化配置管理
    const configManager = new Config();
    const config = configManager.config;

    // 注册菜单命令
    GM_registerMenuCommand('⚙️ 配置设置', () => configManager.showConfigDialog());

    // 创建发送按钮
    function createSendButton(memo) {
        const btn = document.createElement('button');
        btn.innerHTML = '2Anki';
        Object.assign(btn.style, config.buttonStyle);
        btn.addEventListener('click', () => sendToAnki([memo]));
        return btn;
    }


    // 创建复选框
    function createCheckbox(memo) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        Object.assign(checkbox.style, config.checkboxStyle);
        checkbox.dataset.memoId = memo.dataset.slug; // 使用 memo 的唯一标识
        return checkbox;
    }


    // 发送到 Anki
    async function sendToAnki(memos) {
        try {
            const notes = [];

            for (const memo of memos) {
                let content = extractContent(memo);
                const tags = extractTags(memo);
                const modelName = getModelName(tags);

                console.log('原始内容:', content.substring(0, 100) + '...');

                // 处理卡片中的图片
                if (config.downloadImages || config.migrateToOSS) {
                    console.log('准备处理图片, 下载:', config.downloadImages, '迁移到OSS:', config.migrateToOSS);
                    content = await processCardImages(content);
                    console.log('图片处理后内容:', content.substring(0, 100) + '...');
                }

                if (!content) throw new Error('卡片内容为空');

                // 获取包含元数据的字段信息
                const { fields, primaryField } = getFields(content, modelName);

                notes.push({
                    deckName: config.defaultDeck,
                    modelName: modelName,
                    fields: fields,
                    tags: tags,
                    primaryField: primaryField  // 添加主字段信息
                });
            }

            console.log('正在发送到 Anki:', notes);

            // 检查重复卡片并发送
            const { successNotes, updatedNotes } = await checkAndSendNotes(notes);


            // 显示结果
            Swal.fire('成功！', `已成功发送 ${successNotes.length} 张卡片，更新 ${updatedNotes.length} 张卡片到 Anki`, 'success');
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('错误', `发送失败: ${error}`, 'error');
        }
    }

	// 修改后的checkAndSendNotes函数
	async function checkAndSendNotes(notes) {
		const successNotes = [];
		const updatedNotes = [];

		for (const note of notes) {
			try {
				// 获取主字段信息
				const primaryFieldName = note.primaryField.name;
				let primaryFieldValue = note.primaryField.value;

				// 转义特殊字符（双引号）
				primaryFieldValue = primaryFieldValue.replace(/"/g, '\\"');

				// 构建精确查询语句
				const query = `"deck:${note.deckName}" "note:${note.modelName}" "${primaryFieldName}:${primaryFieldValue}"`;

				const findResult = await ankiconnectRequest('findNotes', { query });

				if (findResult.result.length > 0) {
					// 更新现有卡片
					const noteId = findResult.result[0];
					await updateNote(noteId, note);
					updatedNotes.push(note);
				} else {
					// 添加新卡片
					await ankiconnectRequest('addNote', {
						note: {
							deckName: note.deckName,
							modelName: note.modelName,
							fields: note.fields,
							tags: note.tags
						}
					});
					successNotes.push(note);
				}
			} catch (error) {
				console.error('Error:', error);
				throw error;
			}
		}
		return { successNotes, updatedNotes };
	}

	// 新增的updateNote函数
	async function updateNote(noteId, newNote) {
		// 更新字段
		await ankiconnectRequest('updateNoteFields', {
			note: {
				id: noteId,
				fields: newNote.fields
			}
		});

		// 合并标签
		const noteInfo = await ankiconnectRequest('notesInfo', { notes: [noteId] });
		const existingTags = noteInfo.result[0].tags || [];
		const mergedTags = [...new Set([...existingTags, ...newNote.tags])];

		// 直接传递 noteId 和 tags
		await ankiconnectRequest('updateNoteTags', {
			note: noteId,
			tags: mergedTags
		});
	}

    // 提取内容并处理
    function extractContent(memo) {
        const contentElement = memo.querySelector('.mainContent');
        if (!contentElement) return '';

        // 克隆节点以避免修改原始 DOM
        const clonedContent = contentElement.cloneNode(true);

        // 剔除不需要的部分
        const relatedElements = clonedContent.querySelectorAll('.related');
        relatedElements.forEach((el) => el.remove());

        // 清理无效标签
        let cleanedContent = cleanInvalidTags(clonedContent.innerHTML);

        // 删除内容中的 # 标签
        cleanedContent = cleanedContent.replace(/<span class="tag">#(.*?)<\/span>/g, '');

        // 添加时间链接
        const timeLink = memo.querySelector('.time');
        if (timeLink) {
            const timeText = timeLink.querySelector('.text')?.innerText || '';
            const memoId = timeLink.getAttribute('href').split('=')[1];
            const fullUrl = `https://flomoapp.com/mine/?memo_id=${memoId}`;
            cleanedContent += `Source:<a href="${fullUrl}">${timeText}</a>`;
        }

        return cleanedContent.trim();
    }


    // 提取标签并处理
    function extractTags(memo) {
        const tags = [];
        const tagElements = memo.querySelectorAll('.richText .tag');
        tagElements.forEach((tag) => {
            let tagText = tag.innerText.replace('#', ''); // 去掉 #
            tagText = tagText.replace(/\//g, '::'); // 将 / 替换为 ::
            tags.push(tagText);
        });
        return tags;
    }


    // 根据标签选择模板名称
    function getModelName(tags) {
        if (tags.includes('AK问答')) {
            return '问答卡片';
        } else if (tags.includes('AK划线')) {
            return '划线卡片';
        } else {
            return config.defaultModel; // 默认模板
        }
    }


	// 根据模板名称处理内容并生成字段
	function getFields(content, modelName) {
		const fields = {};
		if (modelName === '问答卡片') {
			// 创建一个临时 DOM 元素来解析 HTML
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = content;

			// 获取所有的 <p> 标签
			const paragraphs = tempDiv.querySelectorAll('p');

			let question = '';

			// 处理第一个 <p> 标签
			const firstParagraph = paragraphs[0];
			const firstParagraphText = firstParagraph.textContent.trim();

			// 判断第一个 <p> 标签是否包含问题
			if (firstParagraphText && !firstParagraphText.endsWith('#')) {
				// 情况1：标签与问题在同一行
				question = firstParagraphText.replace(/#[^ ]+/g, '').trim(); // 去掉标签
			} else {
				// 情况2：标签单独一行，问题在随后一行
				if (paragraphs.length > 1) {
					question = paragraphs[1].textContent.trim();
				}
			}
			// 剩余内容作为答案字段
			const answer = content
			.replace(question, '') // 剔除问题部分
			.replace(/<p>\s*<\/p>/g, '') // 匹配 <p></p> 及其内部的空白字符
			.replace(/<p\s*\/>/g, '') // 匹配自闭合的 <p />
			.trim();
			return {
				fields: {
					[config.fieldMapping[modelName].Front] : question,
					[config.fieldMapping[modelName].Back] : answer
				},
				primaryField: {
					name: config.fieldMapping[modelName].Front,
					value: question
				}
			};
			}else {
			return {
				fields: {
					[config.fieldMapping[modelName].Front] : content,
					[config.fieldMapping[modelName].Back] : content
					},
				primaryField: {
					name: config.fieldMapping[modelName].Front,
					value: content
				}
			};
		}
	}

    // 清理无效标签
    function cleanInvalidTags(html) {
        // 剔除 <!----> 注释标签
        html = html.replace(/<!---->/g, '');

        //将flomo卡片中的缩略图链接改为原图链接
        html = html.replace(/<img[^>]*src="([^"]*\/thumbnail[^"]*)"[^>]*data-source="([^"]*)"[^>]*>/g, '<img src="$2" class="el-image__inner" style="object-fit: cover;">');

        // 剔除空的 <div class="placeholder"></div>
        html = html.replace(/<div[^>]*class="placeholder"[^>]*><\/div>/g, '');

        // 剔除其他空的 div 标签
        html = html.replace(/<div[^>]*><\/div>/g, '');

        return html.trim();
    }


    // 发送 Ankiconnect 请求
    function ankiconnectRequest(action, params) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: config.ankiconnectUrl,
                data: JSON.stringify({ action, version: 6, params }),
                responseType: 'json',
                onload: (response) => {
                    const res = response.response;
                    res && res.error ? reject(res.error) : resolve(res);
                },
                onerror: (error) => reject(error),
            });
        });
    }


	// 初始化
	function init() {
		// 查找所有卡片
		const memos = document.querySelectorAll('.memo.normal');
		memos.forEach((memo) => {
			addCheckboxAndButton(memo); // 为每张卡片添加复选框和按钮
		});

		// 添加批量发送按钮和全选按钮
		addBatchAndSelectAllButtons();
	}


	// 为单张卡片添加复选框和按钮
	function addCheckboxAndButton(memo) {
		// 检查是否已添加按钮和复选框
		if (!memo.querySelector('.flomo2anki-btn')) {
			const tools = memo.querySelector('.tools');
			if (tools) {
				// 创建发送按钮
				const btn = createSendButton(memo);
				btn.classList.add('flomo2anki-btn');
				tools.appendChild(btn);

				// 创建复选框
				const checkbox = createCheckbox(memo);
				checkbox.classList.add('flomo2anki-checkbox');
				tools.appendChild(checkbox);
			}
		}
	}


	// 全选按钮点击事件
	function handleSelectAll() {
		// 获取所有复选框（包括后续动态加载的）
		const checkboxes = document.querySelectorAll('.flomo2anki-checkbox');
		const selectAllBtn = document.querySelector('#flomo2anki-select-all-btn');

		// 判断当前是否处于"全选"状态
		const isAllSelected = selectAllBtn.dataset.allSelected === 'true';

		// 切换所有复选框的状态
		checkboxes.forEach((checkbox) => {
			checkbox.checked = !isAllSelected; // 如果当前是全选，则取消全选；反之则全选
		});

		// 更新全选按钮的状态
		selectAllBtn.dataset.allSelected = !isAllSelected;

		// 更新按钮文本
		selectAllBtn.innerHTML = isAllSelected ? '全选' : '取消全选';

		// 提示用户
		Swal.fire('提示', isAllSelected ? '已取消全选' : '已全选所有卡片', 'info');
	}


	// 添加批量发送按钮和全选按钮
	function addBatchAndSelectAllButtons() {
		if (!document.querySelector('#flomo2anki-batch-btn')) {
			// 创建全选按钮
			const selectAllBtn = document.createElement('button');
			selectAllBtn.id = 'flomo2anki-select-all-btn';
			selectAllBtn.innerHTML = '全选';
			Object.assign(selectAllBtn.style, config.buttonStyle);
			selectAllBtn.style.marginRight = '10px'; // 与批量发送按钮保持间距
			selectAllBtn.dataset.allSelected = 'false'; // 初始状态为"未全选"
			selectAllBtn.addEventListener('click', handleSelectAll); // 绑定点击事件

			// 创建批量发送按钮
			const batchBtn = document.createElement('button');
			batchBtn.id = 'flomo2anki-batch-btn';
			batchBtn.innerHTML = '批量发送到 Anki';
			Object.assign(batchBtn.style, config.buttonStyle);

			// 将按钮固定在页面右下角
			const buttonContainer = document.createElement('div');
			buttonContainer.style.position = 'fixed';
			buttonContainer.style.bottom = '20px';
			buttonContainer.style.right = '20px';
			buttonContainer.style.zIndex = '9999';
			buttonContainer.style.display = 'flex'; // 使用 flex 布局使按钮水平排列
			buttonContainer.appendChild(selectAllBtn); // 添加全选按钮
			buttonContainer.appendChild(batchBtn); // 添加批量发送按钮

			// 绑定批量发送按钮的点击事件
			batchBtn.addEventListener('click', () => {
				const selectedMemos = document.querySelectorAll('.flomo2anki-checkbox:checked');
				if (selectedMemos.length === 0) {
					Swal.fire('提示', '请至少选择一张卡片', 'info');
					return;
				}
				const memos = Array.from(selectedMemos).map((checkbox) =>
					document.querySelector(`.memo.normal[data-slug="${checkbox.dataset.memoId}"]`)
				);
				sendToAnki(memos);
			});

			// 将按钮容器添加到页面中
			document.body.appendChild(buttonContainer);
		}
	}

	// 监听页面变化
	const observer = new MutationObserver((mutationsList) => {
		for (const mutation of mutationsList) {
			if (mutation.type === 'childList') {
				// 检查新增的节点
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === 1 && node.classList.contains('memo')) { // 检查是否是卡片节点
						addCheckboxAndButton(node); // 为新卡片添加复选框和按钮

						// 如果全选按钮处于"全选"状态，确保新卡片也被选中
						const isAllSelected = document.querySelector('#flomo2anki-select-all-btn')?.dataset.allSelected === 'true';
						if (isAllSelected) {
							const checkbox = node.querySelector('.flomo2anki-checkbox');
							if (checkbox) {
								checkbox.checked = true; // 勾选新卡片的复选框
							}
						}
					}
				});
			}
		}
	});

	// 开始观察页面变化
	observer.observe(document.body, { childList: true, subtree: true });

    // 页面加载完成后初始化
    window.addEventListener('load', init);

    // 添加图片处理函数
    // 从URL中提取原始文件名
    function extractFilenameFromUrl(url) {
        try {
            // 移除查询参数
            const urlWithoutParams = url.split('?')[0];
            
            // 获取URL的最后部分作为文件名
            let filename = urlWithoutParams.split('/').pop();
            
            // 处理flomoapp.com的图片URL
            if (url.includes('flomoapp.com')) {
                // 从URL中提取文件名部分
                const matches = urlWithoutParams.match(/\/([\d\.\-_]+[a-zA-Z0-9]+\.[a-zA-Z0-9]+)$/);
                if (matches && matches[1]) {
                    filename = matches[1];
                }
            }
            
            // 确保文件名有扩展名
            if (!filename.includes('.')) {
                filename += '.png';
            }
            
            // 清理文件名
            filename = sanitizeFilename(filename);
            console.log(`从URL提取文件名: ${url} -> ${filename}`);
            return filename;
        } catch (error) {
            console.error('提取文件名失败:', error, url);
            return `img_${Date.now()}.png`;
        }
    }

    // 清理文件名（移除不允许的字符）
    function sanitizeFilename(filename) {
        // 替换Windows文件名中不允许的字符
        let sanitized = filename.replace(/[<>:"\/\\|?*]/g, '_');

        // 限制文件名长度，防止路径过长错误
        if (sanitized.length > 100) {
            const extension = sanitized.includes('.') ? sanitized.substring(sanitized.lastIndexOf('.')) : '';
            sanitized = sanitized.substring(0, 100 - extension.length) + extension;
        }

        return sanitized;
    }

    // 构建预期的第三方图床 URL
    function buildOssUrl(filename) {
        // 确保文件名是纯文件名，不包含路径
        const pureName = filename.split('/').pop();
        return `https://${config.aliyunOSS.bucket}.${config.aliyunOSS.endpoint}/${config.aliyunOSS.folder}${pureName}`;
    }

    // 下载单个图片
    function downloadImage(imageUrl, filename) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`开始下载图片: ${imageUrl} 保存为 ${filename}`);

                // 直接保存文件名，不加路径前缀
                GM_download({
                    url: imageUrl,
                    name: filename,
                    saveAs: !config.aliyunOSS.saveWithoutDialog, // 是否显示保存对话框
                    onload: function() {
                        console.log(`图片下载成功: ${filename}`);
                        resolve(filename);
                    },
                    onerror: function(error) {
                        console.error(`图片下载失败: ${imageUrl}, 错误: ${error}`);
                        reject(new Error(`下载失败: ${error}`));
                    }
                });
            } catch (error) {
                console.error(`下载请求出错: ${error.message}`);
                reject(error);
            }
        });
    }

    // 处理卡片中的图片
    async function processCardImages(content) {
        console.log('处理卡片图片开始，原始内容长度:', content.length);
        
        // 创建临时DOM元素解析HTML内容
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        
        // 获取所有图片元素
        const images = tempDiv.querySelectorAll('img');
        console.log(`找到 ${images.length} 张图片需要处理`);
        
        // 如果启用了迁移到OSS
        if (config.migrateToOSS) {
            for (const img of images) {
                const originalUrl = img.getAttribute('data-source') || img.src;
                if (!originalUrl) continue;
                
                const filename = extractFilenameFromUrl(originalUrl);
                console.log(`处理图片: ${originalUrl} -> 文件名: ${filename}`);
                
                // 如果配置了下载图片
                if (config.downloadImages) {
                    try {
                        await downloadImage(originalUrl, filename);
                    } catch (error) {
                        console.error(`下载图片失败: ${originalUrl}`, error);
                    }
                }
                
                // 替换为OSS链接
                const ossUrl = buildOssUrl(filename);
                console.log(`替换图片链接: ${originalUrl} -> ${ossUrl}`);
                img.src = ossUrl;
            }
            
            // 获取处理后的HTML
            const processedContent = tempDiv.innerHTML;
            console.log('处理后的内容长度:', processedContent.length);
            return processedContent;
        }
        
        // 如果只启用了下载但不迁移到OSS
        if (config.downloadImages && !config.migrateToOSS) {
            for (const img of images) {
                const originalUrl = img.getAttribute('data-source') || img.src;
                if (!originalUrl) continue;
                
                const filename = extractFilenameFromUrl(originalUrl);
                console.log(`仅下载图片: ${originalUrl} -> 文件名: ${filename}`);
                
                try {
                    await downloadImage(originalUrl, filename);
                } catch (error) {
                    console.error(`下载图片失败: ${originalUrl}`, error);
                }
            }
        }
        
        // 如果没有启用OSS迁移，返回原始内容
        console.log('返回内容，长度:', content.length);
        return content;
    }
})();