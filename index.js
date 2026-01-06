document.addEventListener('DOMContentLoaded', () => {
    const fileInputs = [null, document.getElementById('fileInput1'), document.getElementById('fileInput2')];
    const fileNames = [null, document.getElementById('fileName1'), document.getElementById('fileName2')];
    const areas = [null, document.getElementById('area1'), document.getElementById('area2')];
    const actionBtn = document.getElementById('actionBtn');
    const statusDiv = document.getElementById('status');
    
    let files = [null, null, null]; // index 1 and 2
    let downloadUrl = null;

    // --- UI 互動邏輯 ---
    window.triggerFile = (idx) => fileInputs[idx].click();
    
    window.clearFile = (idx, event) => {
        event.stopPropagation(); // 防止觸發上傳點擊
        fileInputs[idx].value = '';
        files[idx] = null;
        updateUIState(idx);
    };

    [1, 2].forEach(idx => {
        fileInputs[idx].addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                files[idx] = e.target.files[0];
                updateUIState(idx);
            }
        });
    });

    function updateUIState(idx) {
        // 更新個別區塊樣式
        if (files[idx]) {
            fileNames[idx].textContent = files[idx].name;
            fileNames[idx].style.color = "#2d3748";
            areas[idx].classList.add('has-file');
        } else {
            fileNames[idx].textContent = "點擊選擇檔案";
            fileNames[idx].style.color = "#718096";
            areas[idx].classList.remove('has-file');
        }

        // 更新按鈕狀態
        if (files[1] && files[2]) {
            actionBtn.textContent = "開始比對 (Compare)";
            actionBtn.disabled = false;
        } else if (files[1] || files[2]) {
            actionBtn.textContent = "開始轉換 (Single Mode)";
            actionBtn.disabled = false;
        } else {
            actionBtn.textContent = "請至少上傳一個檔案";
            actionBtn.disabled = true;
        }
        
        // 重置下載狀態
        actionBtn.classList.remove('download');
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
            downloadUrl = null;
        }
        statusDiv.textContent = "";
    }

    // --- 主流程邏輯 ---
    actionBtn.addEventListener('click', () => {
        if (actionBtn.classList.contains('download')) {
            const a = document.createElement('a');
            a.href = downloadUrl;
            
            let baseName = "report";
            if (files[1] && files[2]) {
                baseName = `Compare_${files[1].name}_vs_${files[2].name}`;
            } else {
                const f = files[1] || files[2];
                baseName = f.name.replace(/\.(txt|html|htm)$/i, '') + '_report';
            }
            
            a.download = baseName + '.html';
            a.click();
        } else {
            processFiles();
        }
    });

    async function processFiles() {
        actionBtn.disabled = true;
        actionBtn.textContent = "處理運算中...";
        statusDiv.textContent = "正在讀取並解析檔案...";

        try {
            // 讀取檔案 (使用 Promise 封裝)
            const readPromises = [];
            if (files[1]) readPromises.push(readFileContent(files[1]));
            if (files[2]) readPromises.push(readFileContent(files[2]));

            const contents = await Promise.all(readPromises);
            
            let finalHtml = "";

            if (files[1] && files[2]) {
                // 雙檔模式：比對
                const sectionsA = parseLog(contents[0]);
                const sectionsB = parseLog(contents[1]);
                finalHtml = generateDiffReport(files[1].name, files[2].name, sectionsA, sectionsB);
                statusDiv.textContent = "比對完成！發現差異並已標記。";
            } else {
                // 單檔模式：原功能
                const content = contents[0];
                const activeFile = files[1] || files[2];
                const sections = parseLog(content);
                if (sections.length === 0) throw new Error("無法識別結構，請確認檔案包含 '[ SECTION ]'");
                finalHtml = generateSingleReport(activeFile.name, sections);
                statusDiv.textContent = `解析成功！共 ${sections.length} 個區塊。`;
            }

            const blob = new Blob([finalHtml], { type: 'text/html' });
            downloadUrl = URL.createObjectURL(blob);

            actionBtn.textContent = "下載 HTML 報告";
            actionBtn.classList.add('download');
            actionBtn.disabled = false;

        } catch (err) {
            console.error(err);
            statusDiv.textContent = "錯誤: " + err.message;
            statusDiv.style.color = "#e53e3e";
            actionBtn.textContent = "重試";
            actionBtn.disabled = false;
        }
    }

    // --- 輔助函式 ---

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                let text = e.target.result;
                // 簡易 HTML 轉文字處理
                if (file.name.match(/\.html?$/i)) {
                    text = extractTextFromHtml(text);
                }
                resolve(text);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    function extractTextFromHtml(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const preTags = doc.getElementsByTagName('pre');
        if (preTags.length > 0) {
            let combined = "";
            for(let p of preTags) combined += p.textContent + "\n";
            return combined;
        }
        return doc.body.textContent || doc.documentElement.textContent;
    }

    function parseLog(text) {
        const regex = /={50,}\n\s*\[ SECTION \] (.*?)\n={50,}\n/g;
        const sections = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const title = match[1].trim();
            const startIndex = match.index;
            const endIndex = regex.lastIndex;

            if (startIndex > lastIndex) {
                const content = text.substring(lastIndex, startIndex).trim();
                if (content && sections.length === 0) {
                    sections.push({ title: "File Header / Meta", content: content, id: "header" });
                } else if (content && sections.length > 0) {
                     sections[sections.length - 1].content = content;
                }
            }
            const safeId = "sec-" + Math.random().toString(36).substr(2, 9);
            sections.push({ title: title, content: "", id: safeId });
            lastIndex = endIndex;
        }
        if (lastIndex < text.length) {
            const content = text.substring(lastIndex).trim();
            if (sections.length > 0) sections[sections.length - 1].content = content;
        }
        return sections;
    }

    // --- 報告生成邏輯 (單檔) ---
    function generateSingleReport(filename, sections) {
        // 沿用原本的邏輯，但為了程式碼共用性，這裡直接調用模板
        const navItems = sections.map(s => `<a href="#${s.id}" class="nav-link">${escapeHtml(s.title)}</a>`).join('');
        const contentItems = sections.map(s => renderSectionCard(s.id, s.title, escapeHtml(s.content))).join('');
        return renderHtmlTemplate(filename, navItems, contentItems);
    }

    // --- 報告生成邏輯 (比對) ---
    function generateDiffReport(nameA, nameB, secsA, secsB) {
        const mapA = new Map(secsA.map(s => [s.title, s.content]));
        const mapB = new Map(secsB.map(s => [s.title, s.content]));
        
        // 取得所有唯一的標題
        const allTitles = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
        
        let navHtml = "";
        let contentHtml = "";

        allTitles.forEach((title, index) => {
            const contentA = mapA.get(title);
            const contentB = mapB.get(title);
            const safeId = "diff-" + index;
            
            let statusClass = "";
            let displayContent = "";

            if (contentA === undefined) {
                // 新增的區塊 (只在 B 有)
                statusClass = "status-added";
                displayContent = `<div class="diff-block diff-add">${escapeHtml(contentB)}</div>`;
                navHtml += `<a href="#${safeId}" class="nav-link diff-add-mark">[+] ${escapeHtml(title)}</a>`;
            } else if (contentB === undefined) {
                // 刪除的區塊 (只在 A 有)
                statusClass = "status-removed";
                displayContent = `<div class="diff-block diff-del">${escapeHtml(contentA)}</div>`;
                navHtml += `<a href="#${safeId}" class="nav-link diff-del-mark">[-] ${escapeHtml(title)}</a>`;
            } else if (contentA !== contentB) {
                // 內容變更 -> 執行行比對
                statusClass = "status-modified";
                displayContent = computeLineDiff(contentA, contentB);
                navHtml += `<a href="#${safeId}" class="nav-link diff-mod-mark">[M] ${escapeHtml(title)}</a>`;
            } else {
                // 內容相同
                statusClass = "status-same";
                displayContent = escapeHtml(contentA);
                navHtml += `<a href="#${safeId}" class="nav-link">${escapeHtml(title)}</a>`;
            }

            contentHtml += renderSectionCard(safeId, title, displayContent, statusClass);
        });

        return renderHtmlTemplate(`Compare: ${nameA} vs ${nameB}`, navHtml, contentHtml, true);
    }

    // --- 簡易行比對演算法 (Diff) ---
    function computeLineDiff(textA, textB) {
        const linesA = textA.split('\n');
        const linesB = textB.split('\n');
        
        // 這裡使用簡單的 "Naive" 比對：
        // 如果完全不同，展示 Unified Diff 風格
        // 為了效能與實作複雜度，不做複雜的 Myers Diff (LCS)，而是做「對應行」標示
        
        let html = "";
        let i = 0, j = 0;
        
        // 簡單比較邏輯
        while(i < linesA.length || j < linesB.length) {
            const lineA = linesA[i];
            const lineB = linesB[j];

            if (lineA === lineB) {
                html += `<div>${escapeHtml(lineA || "")}</div>`; // 相同，一般顯示
                i++; j++;
            } else {
                // 嘗試找尋是否存在於後方 (簡單的同步嘗試)
                // 這裡簡化處理：直接顯示 A 為紅，B 為綠
                if (lineA !== undefined) {
                    html += `<div class="line-del">- ${escapeHtml(lineA)}</div>`;
                    i++;
                }
                if (lineB !== undefined) {
                    html += `<div class="line-add">+ ${escapeHtml(lineB)}</div>`;
                    j++;
                }
            }
        }
        return html;
    }

    // --- HTML 模板渲染 ---
    function renderSectionCard(id, title, contentHtml, statusClass = "") {
        let badge = "";
        if (statusClass === "status-added") badge = `<span class="badge badge-add">New Section</span>`;
        if (statusClass === "status-removed") badge = `<span class="badge badge-del">Removed Section</span>`;
        if (statusClass === "status-modified") badge = `<span class="badge badge-mod">Modified</span>`;

        return `
            <div id="${id}" class="section-card ${statusClass}">
                <div class="section-header">
                    <h2>${escapeHtml(title)} ${badge}</h2>
                    <button class="copy-btn" onclick="copyToClipboard('${id}')">複製內容</button>
                </div>
                <div class="section-body">
                    <pre id="pre-${id}">${contentHtml}</pre>
                </div>
            </div>
        `;
    }

    function renderHtmlTemplate(title, navHtml, contentHtml, isDiffMode = false) {
        const dateStr = new Date().toLocaleString();
        
        // 額外的 CSS 用於 Diff 樣式
        const diffCss = `
            .diff-add-mark { color: #68d391 !important; font-weight: bold; }
            .diff-del-mark { color: #fc8181 !important; font-weight: bold; }
            .diff-mod-mark { color: #f6ad55 !important; font-weight: bold; }
            
            .badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; color: white; margin-left: 10px; vertical-align: middle; }
            .badge-add { background: #48bb78; }
            .badge-del { background: #f56565; }
            .badge-mod { background: #ed8936; }

            .line-add { background-color: #e6fffa; color: #276749; display: block; width: 100%; }
            .line-del { background-color: #fff5f5; color: #c53030; display: block; width: 100%; text-decoration: line-through; opacity: 0.8; }
            
            .diff-block.diff-add { background-color: #f0fff4; border: 1px solid #9ae6b4; padding: 10px; }
            .diff-block.diff-del { background-color: #fff5f5; border: 1px solid #feb2b2; padding: 10px; opacity: 0.7; }
        `;

        return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        :root { --sidebar-width: 300px; --primary: #2b6cb0; --bg: #f7fafc; --text: #2d3748; }
        body { margin: 0; display: flex; height: 100vh; font-family: Consolas, Monaco, "Courier New", monospace; color: var(--text); background: var(--bg); overflow: hidden; }
        aside { width: var(--sidebar-width); background: #1a202c; color: #e2e8f0; display: flex; flex-direction: column; flex-shrink: 0; }
        .nav-header { padding: 1.5rem; background: #2d3748; border-bottom: 1px solid #4a5568; }
        .nav-header h3 { margin: 0; font-size: 1rem; color: white; word-break: break-all; }
        .nav-list { flex: 1; overflow-y: auto; padding: 1rem 0; }
        .nav-link { display: block; padding: 0.75rem 1.5rem; color: #cbd5e0; text-decoration: none; font-size: 0.85rem; border-left: 3px solid transparent; transition: 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nav-link:hover { background: #2d3748; color: white; }
        
        main { flex: 1; overflow-y: auto; padding: 2rem; scroll-behavior: smooth; position: relative; }
        .section-card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 2rem; border: 1px solid #e2e8f0; overflow: hidden; }
        .section-header { background: #edf2f7; padding: 0.75rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 10; }
        .section-header h2 { margin: 0; font-size: 1.1rem; color: var(--primary); display: flex; align-items: center; }
        .copy-btn { background: white; border: 1px solid #cbd5e0; padding: 4px 12px; font-size: 0.75rem; border-radius: 4px; cursor: pointer; }
        
        .section-body { padding: 0; overflow-x: auto; }
        pre { margin: 0; padding: 1.5rem; font-size: 0.85rem; line-height: 1.5; color: #1a202c; white-space: pre-wrap; word-wrap: break-word; }
        
        ${diffCss}
        
        @media (max-width: 768px) { body { flex-direction: column; } aside { width: 100%; height: 200px; } }
    </style>
</head>
<body>
    <aside>
        <div class="nav-header">
            <h3>${title}</h3>
            <div style="font-size: 0.75rem; color: #a0aec0; margin-top: 5px;">${dateStr}</div>
        </div>
        <nav class="nav-list">
            ${navHtml}
        </nav>
    </aside>
    <main>
        ${contentHtml}
        <div style="text-align: center; color: #a0aec0; padding: 2rem;">End of Report</div>
    </main>
    <script>
        function copyToClipboard(id) {
            const el = document.getElementById('pre-' + id);
            // 若為 Diff 模式，只複製純文字，不複製 HTML 標籤
            const text = el.innerText; 
            navigator.clipboard.writeText(text).then(() => {
                alert('內容已複製');
            });
        }
    <\/script>
</body>
</html>`;
    }

    function escapeHtml(text) {
        if (!text && text !== 0) return "";
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }
});