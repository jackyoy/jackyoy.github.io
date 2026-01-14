document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const outputArea = document.getElementById('outputArea');
    const navList = document.getElementById('navList');

    // --- 1. 事件綁定修正 ---

    // 點擊 DropZone -> 觸發隱藏的 Input 點擊
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Input 改變 (使用者選檔後)
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
        // 重要：重置 input，否則無法重複上傳同一個檔案
        fileInput.value = '';
    });

    // 拖曳事件處理 (防止瀏覽器直接開啟檔案)
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 拖曳視覺效果
    dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
    ['dragleave', 'drop'].forEach(evt => 
        dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover'))
    );

    // 處理拖曳放下的檔案
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    });

    // --- 2. 檔案處理核心邏輯 ---

    async function handleFiles(fileList) {
        const files = Array.from(fileList);
        
        // 簡單驗證
        if (files.length > 2) {
            alert('錯誤：最多只能同時上傳 2 個檔案進行比對。');
            return;
        }

        outputArea.innerHTML = '<div style="padding:20px; color:#aaa;">正在處理檔案...</div>';
        navList.innerHTML = ''; // 清空導航

        try {
            if (files.length === 1) {
                // 單檔模式
                const content = await readFile(files[0]);
                renderSingleFile(files[0].name, content);
            } else {
                // 雙檔比對模式
                // 為了確保順序，我們可以依照檔名排序，或依選擇順序
                const content1 = await readFile(files[0]);
                const content2 = await readFile(files[1]);
                renderDiffView(files[0].name, content1, files[1].name, content2);
            }
        } catch (err) {
            console.error(err);
            outputArea.innerHTML = `<div style="color:#ff6b6b; padding:20px;">讀取失敗: ${err.message}</div>`;
        }
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error(`無法讀取檔案: ${file.name}`));
            reader.readAsText(file); // 預設使用 UTF-8
        });
    }

    // --- 3. 標題解析 (用於側邊欄) ---
    // 識別 # 開頭且帶有特殊裝飾的行
    function isHeaderLine(line) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('#')) return false;
        
        const hasDecor = /={3,}|-{3,}/.test(trimmed);
        const hasBrackets = /^#\s*\[.+\]/.test(trimmed); // e.g., # [Step 1]
        const hasSteps = /^#\s*(步驟|Step)\s*\d+/i.test(trimmed); // e.g., # 步驟 1

        return hasDecor || hasBrackets || hasSteps;
    }

    function extractTitle(line) {
        // 移除 #, =, -, [ ] 等符號，保留純文字
        return line.replace(/^#/, '').replace(/[-=\[\]]/g, '').trim();
    }

    // --- 4. 渲染單一檔案 ---
    function renderSingleFile(filename, content) {
        outputArea.innerHTML = '';
        const lines = content.split('\n');
        
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<h3 style="color: #61afef; margin-bottom: 20px; border-bottom:1px solid #444; padding-bottom:10px;">📄 ${filename}</h3>`;
        
        const pre = document.createElement('pre');
        const codeBlock = document.createElement('code');
        codeBlock.className = 'language-bash';
        
        let htmlBuffer = '';
        let headers = [];

        lines.forEach((line, index) => {
            // HTML 跳脫
            const safeLine = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const lineId = `L${index}`;
            
            if (isHeaderLine(line)) {
                headers.push({ id: lineId, text: extractTitle(line) });
                htmlBuffer += `<span id="${lineId}" class="section-header-line">${safeLine}</span>\n`;
            } else {
                htmlBuffer += `${safeLine}\n`;
            }
        });

        codeBlock.innerHTML = htmlBuffer;
        pre.appendChild(codeBlock);
        wrapper.appendChild(pre);
        outputArea.appendChild(wrapper);

        // 執行語法高亮
        if (window.hljs) hljs.highlightElement(codeBlock);
        
        renderSidebar(headers);
    }

    // --- 5. 渲染 Diff 視圖 (強制顯示完整內容) ---
    function renderDiffView(name1, content1, name2, content2) {
        outputArea.innerHTML = '';

        // 計算最大行數，並加上緩衝，確保 Context 足夠大以顯示整份文件
        const maxLines = Math.max(content1.split('\n').length, content2.split('\n').length);
        
        // 產生 Patch (Context 設為無限大)
        const diffString = Diff.createTwoFilesPatch(
            name1, 
            name2, 
            content1, 
            content2, 
            '', '', 
            { context: maxLines + 1000 } 
        );

        const targetElement = document.createElement('div');
        outputArea.appendChild(targetElement);

        const configuration = {
            drawFileList: false,
            matching: 'lines',
            outputFormat: 'side-by-side',
            renderNothingWhenEmpty: false,
            rawTemplates: {
                'generic-file-path': `<span></span>`
            }
        };

        const diff2htmlUi = new Diff2HtmlUI(targetElement, diffString, configuration);
        diff2htmlUi.draw();
        diff2htmlUi.highlightCode();

        // 解析 Diff 視圖中的標題以建立導航
        // 我們鎖定右側 (新檔案) 的內容來生成目錄
        const rightRows = targetElement.querySelectorAll('.d2h-file-side-diff:last-child tr');
        let headers = [];

        rightRows.forEach((row, index) => {
            // 尋找程式碼內容容器
            const codeEl = row.querySelector('.d2h-code-line-ctn');
            if (!codeEl) return;

            const text = codeEl.textContent || "";
            
            if (isHeaderLine(text)) {
                // 由於 Diff2Html 會重繪 DOM，我們直接對 tr 標記 ID
                const lineId = `diff-header-${index}`;
                row.id = lineId; 
                row.setAttribute('data-header', 'true');
                
                headers.push({
                    id: lineId,
                    text: extractTitle(text)
                });
            }
        });

        renderSidebar(headers);
    }

    // --- 6. 側邊欄渲染 ---
    function renderSidebar(headers) {
        navList.innerHTML = '';
        
        if (headers.length === 0) {
            navList.innerHTML = '<li style="padding:15px; color:#666;">未偵測到標題區塊</li>';
            return;
        }

        headers.forEach(header => {
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.textContent = header.text || "(無標題)";
            li.title = header.text;
            
            li.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                li.classList.add('active');

                const target = document.getElementById(header.id);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // 閃爍提示效果
                    target.style.transition = "background-color 0.3s";
                    const originalBg = target.style.backgroundColor;
                    // 使用稍微明顯的顏色閃爍
                    target.style.backgroundColor = "rgba(255, 255, 255, 0.2)"; 
                    setTimeout(() => {
                        target.style.backgroundColor = originalBg;
                    }, 600);
                }
            });

            navList.appendChild(li);
        });
    }
});