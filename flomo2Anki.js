// ==UserScript==
// @name         flomo2Anki
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  将 flomo 笔记发送到 Anki，支持单张和批量发送，并处理标签和时间链接
// @author       springrain
// @match        https://v.flomoapp.com/mine*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// ==/UserScript==


(function () {
    'use strict';


    // ================= 配置区 =================
    const config = {
        ankiconnectUrl: 'http://localhost:8765', // Ankiconnect 地址
        defaultDeck: 'flomo', // 修改为你的牌组名称
        defaultModel: '划线卡片', // 修改为你的模板名称
        fieldMapping: {
            // 字段映射
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
            // 按钮样式
            marginLeft: '10px',
            padding: '5px 10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
        },
        checkboxStyle: {
            // 复选框样式
            marginLeft: '10px',
            cursor: 'pointer',
        },
    };
    // ================= 配置结束 =================


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
            const notes = memos.map((memo) => {
                const content = extractContent(memo);
                const tags = extractTags(memo);
                const modelName = getModelName(tags);
                const fields = getFields(content, modelName);


                if (!content) throw new Error('卡片内容为空');


                return {
                    deckName: config.defaultDeck,
                    modelName: modelName,
                    fields: fields,
                    tags: tags,
                };
            });


            console.log('正在发送到 Anki:', notes); // 调试信息


            // 检查重复卡片并发送
            const { successNotes, updatedNotes } = await checkAndSendNotes(notes);


            // 显示结果
            Swal.fire('成功！', `已成功发送 ${successNotes.length} 张卡片，更新 ${updatedNotes.length} 张卡片到 Anki`, 'success');
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('错误', `发送失败: ${error}`, 'error');
        }
    }


    // 检查重复卡片并发送
    async function checkAndSendNotes(notes) {
        const successNotes = []; // 成功添加的卡片
        const updatedNotes = []; // 成功更新的卡片


        for (const note of notes) {
            try {
                // 查找是否存在相同卡片
                const findResult = await ankiconnectRequest('findNotes', {
                    query: `deck:"${note.deckName}" note:"${note.modelName}" front:"${note.fields.Front}"`,
                });


                if (findResult.result.length > 0) {
                    // 如果找到相同卡片，则更新
                    const noteId = findResult.result[0];
                    await ankiconnectRequest('updateNoteFields', {
                        note: {
                            id: noteId,
                            fields: note.fields,
                        },
                    });
                    updatedNotes.push(note);
                } else {
                    // 如果没有找到，则添加新卡片
                    await ankiconnectRequest('addNote', { note });
                    successNotes.push(note);
                }
            } catch (error) {
                console.error('Error:', error);
                throw error;
            }
        }


        return { successNotes, updatedNotes };
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
        fields[config.fieldMapping[modelName].Front] = question;
        fields[config.fieldMapping[modelName].Back] = answer;
    } else {
        fields[config.fieldMapping[modelName].Front] = content;
        fields[config.fieldMapping[modelName].Back] = content;
    }
    return fields;
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

		// 判断当前是否处于“全选”状态
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
			selectAllBtn.dataset.allSelected = 'false'; // 初始状态为“未全选”
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

						// 如果全选按钮处于“全选”状态，确保新卡片也被选中
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
})();