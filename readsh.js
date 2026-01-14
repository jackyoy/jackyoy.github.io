document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const outputArea = document.getElementById('outputArea');
    const navList = document.getElementById('navList');

    // --- 1. 事件監聽 (拖曳與選擇) ---
    
    // 點擊上傳
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // 拖曳效果
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // --- 2. 檔案處理核心邏輯 ---

    async function handleFiles(files) {
        files = Array.from(files);
        if (files.length === 0) return;
        if (files.length > 2) {
            alert('最多只能比對兩個檔案。');
            return;
        }

        outputArea.innerHTML = '<div style="padding:20px;">載入中...</div>';
        navList.innerHTML = '';

        try {
            if (files.length === 1) {
                const content = await readFile(files[0]);
                renderSingleFile(files[0].name, content);
            } else {
                const content1 = await readFile(files[0]);
                const content2 = await readFile(files[1]);
                renderDiffView(files[0].name, content1, files[1].name, content2);
            }
        } catch (err) {
            console.error(err);
            outputArea.innerHTML = `<div style="color:red; padding:20px;">讀取失敗: ${err.message}</div>`;
        }
    }

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error("檔案讀取錯誤"));
            reader.readAsText(file);
        });
    }

    // --- 3. 標題解析 (用於側邊欄) ---
    
    // 定義什麼算是一個 "標題 (Header)"
    // 規則：以 # 開頭，包含 ===, --- 或 [Text] 等裝飾的行
    function isHeaderLine(line) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('#')) return false;
        
        // 檢查是否包含連續的 = 或 -，或是 [步驟...]
        const hasDecor = /={3,}|-{3,}/.test(trimmed);
        const hasBrackets = /^#\s*\[.+\]/.test(trimmed);
        const hasSteps = /^#\s*(步驟|Step)\s*\d+/i.test(trimmed);

        return hasDecor || hasBrackets || hasSteps;
    }

    function extractTitle(line) {
        // 移除 #, =, - 和空白，只留下文字
        return line.replace(/^#/, '').replace(/[-=]/g, '').trim();
    }

    // --- 4. 渲染單一檔案 ---

    function renderSingleFile(filename, content) {
        outputArea.innerHTML = '';
        const lines = content.split('\n');
        
        // 建立容器
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `<h3 style="color: #61afef; margin-bottom: 20px; border-bottom:1px solid #444; padding-bottom:10px;">📄 ${filename}</h3>`;
        
        const pre = document.createElement('pre');
        const codeBlock = document.createElement('code');
        codeBlock.className = 'language-bash';
        
        // 我們手動構建 HTML，以便插入 ID 到標題行
        let htmlBuffer = '';
        let headers = [];

        lines.forEach((line, index) => {
            // 簡易 HTML 跳脫
            const safeLine = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const lineId = `L${index}`;
            
            if (isHeaderLine(line)) {
                // 記錄標題供側邊欄使用
                headers.push({ id: lineId, text: extractTitle(line) });
                // 加入帶有 ID 的 Span
                htmlBuffer += `<span id="${lineId}" class="section-header-line">${safeLine}</span>\n`;
            } else {
                htmlBuffer += `${safeLine}\n`;
            }
        });

        codeBlock.innerHTML = htmlBuffer;
        pre.appendChild(codeBlock);
        wrapper.appendChild(pre);
        outputArea.appendChild(wrapper);

        // 啟用高亮
        hljs.highlightElement(codeBlock);

        // 生成側邊欄
        renderSidebar(headers);
    }

    // --- 5. 渲染 Diff 視圖 (完整內容) ---

    function renderDiffView(name1, content1, name2, content2) {
        outputArea.innerHTML = '';

        // 關鍵設定：context 設為極大值，強迫顯示所有內容
        const maxLines = Math.max(content1.split('\n').length, content2.split('\n').length);
        
        // 使用 createTwoFilesPatch 產生 Patch
        const diffString = Diff.createTwoFilesPatch(
            name1, 
            name2, 
            content1, 
            content2, 
            '', '', 
            { context: maxLines + 100 } // <--- 這裡確保顯示完整檔案
        );

        const targetElement = document.createElement('div');
        outputArea.appendChild(targetElement);

        const configuration = {
            drawFileList: false,
            matching: 'lines',
            outputFormat: 'side-by-side',
            renderNothingWhenEmpty: false,
            rawTemplates: {
                // 微調模板以移除不必要的空白
                'generic-file-path': `<span></span>` 
            }
        };

        const diff2htmlUi = new Diff2HtmlUI(targetElement, diffString, configuration);
        diff2htmlUi.draw();
        diff2htmlUi.highlightCode();

        // --- Diff 後處理：注入 ID 並生成導航 ---
        // 我們以 "右側 (新檔案)" 的內容作為導航基準
        
        const rightRows = targetElement.querySelectorAll('.d2h-file-side-diff:last-child tr');
        let headers = [];

        rightRows.forEach((row, index) => {
            const codeEl = row.querySelector('.d2h-code-line-ctn');
            if (!codeEl) return;

            const text = codeEl.textContent || "";
            
            if (isHeaderLine(text)) {
                const lineId = `diff-L${index}`;
                row.id = lineId; // 將 ID 加在 tr 上
                row.setAttribute('data-header', 'true'); // 用於 CSS 樣式
                
                headers.push({
                    id: lineId,
                    text: extractTitle(text)
                });
            }
        });

        renderSidebar(headers);
    }

    // --- 6. 通用側邊欄渲染 ---

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
            li.title = header.text; // Tooltip
            
            li.addEventListener('click', () => {
                // 移除其他 active 狀態
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                li.classList.add('active');

                // 捲動到目標 ID
                const target = document.getElementById(header.id);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // 短暫閃爍效果
                    target.style.transition = "background-color 0.5s";
                    const originalBg = target.style.backgroundColor;
                    target.style.backgroundColor = "#444"; // 閃爍色
                    setTimeout(() => {
                        target.style.backgroundColor = originalBg;
                    }, 500);
                }
            });

            navList.appendChild(li);
        });
    }
});