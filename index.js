document.addEventListener('DOMContentLoaded', () => {
    const fileInputs = [null, document.getElementById('fileInput1'), document.getElementById('fileInput2')];
    const fileNames = [null, document.getElementById('fileName1'), document.getElementById('fileName2')];
    const areas = [null, document.getElementById('area1'), document.getElementById('area2')];
    const actionBtn = document.getElementById('actionBtn');
    const statusDiv = document.getElementById('status');
    
    let files = [null, null, null]; 
    let downloadUrl = null;

    // --- UI 互動邏輯 ---
    window.triggerFile = (idx) => fileInputs[idx].click();
    
    window.clearFile = (idx, event) => {
        event.stopPropagation();
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
        if (files[idx]) {
            fileNames[idx].textContent = files[idx].name;
            fileNames[idx].style.color = "#2d3748";
            areas[idx].classList.add('has-file');
        } else {
            fileNames[idx].textContent = "點擊選擇檔案";
            fileNames[idx].style.color = "#718096";
            areas[idx].classList.remove('has-file');
        }

        if (files[1] && files[2]) {
            actionBtn.textContent = "開始左右比對 (Side-by-Side)";
            actionBtn.disabled = false;
        } else if (files[1] || files[2]) {
            actionBtn.textContent = "開始轉換 (Single Mode)";
            actionBtn.disabled = false;
        } else {
            actionBtn.textContent = "請至少上傳一個檔案";
            actionBtn.disabled = true;
        }
        
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
            const readPromises = [];
            if (files[1]) readPromises.push(readFileContent(files[1]));
            if (files[2]) readPromises.push(readFileContent(files[2]));

            const contents = await Promise.all(readPromises);
            
            let finalHtml = "";

            if (files[1] && files[2]) {
                const sectionsA = parseLog(contents[0]);
                const sectionsB = parseLog(contents[1]);
                finalHtml = generateSideBySideDiffReport(files[1].name, files[2].name, sectionsA, sectionsB);
                statusDiv.textContent = "比對完成！已生成左右對照表。";
            } else {
                const content = contents[0];
                const activeFile = files[1] || files[2];
                const sections = parseLog(content);
                
                if (sections.length === 0) {
                    throw new Error("無法識別檔案結構，請確認檔案內容符合格式。");
                }
                
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

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                let text = e.target.result;
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
        const regexDiag = /={50,}\n\s*\[ SECTION \] (.*?)\n={50,}\n/g; 
        const regexStatic = /={50,}\n說明:\s*(.*?)\n指令:\s*(.*?)\n-{50,}\n/g;

        let regex = regexDiag;
        let isStaticFormat = false;

        if (text.search(regexStatic) !== -1) {
            regex = regexStatic;
            isStaticFormat = true;
        }

        const sections = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const title = match[1].trim();
            const commandMeta = isStaticFormat && match[2] ? match[2].trim() : null;
            
            const startIndex = match.index;
            const endIndex = regex.lastIndex;

            if (startIndex > lastIndex) {
                let content = text.substring(lastIndex, startIndex).trim();
                
                if (content || sections.length > 0) {
                    if (sections.length > 0) {
                        let finalContent = content;
                        if (sections[sections.length - 1].extraInfo) {
                            finalContent = `Command: ${sections[sections.length - 1].extraInfo}\n\n${content}`;
                        }
                        sections[sections.length - 1].content = finalContent;
                    } else {
                        sections.push({ title: "File Header / Meta", content: content, id: "header" });
                    }
                }
            }
            
            const safeId = "sec-" + Math.random().toString(36).substr(2, 9);
            sections.push({ 
                title: title, 
                content: "", 
                extraInfo: commandMeta, 
                id: safeId 
            });
            
            lastIndex = endIndex;
        }

        if (lastIndex < text.length) {
            const content = text.substring(lastIndex).trim();
            if (sections.length > 0) {
                let finalContent = content;
                if (sections[sections.length - 1].extraInfo) {
                    finalContent = `Command: ${sections[sections.length - 1].extraInfo}\n\n${content}`;
                }
                sections[sections.length - 1].content = finalContent;
            }
        }

        return sections;
    }

    // --- 報告生成 (單檔) ---
    function generateSingleReport(filename, sections) {
        const navItems = sections.map(s => `<a href="#${s.id}" class="nav-link">${escapeHtml(s.title)}</a>`).join('');
        const contentItems = sections.map(s => `
            <div id="${s.id}" class="section-card">
                <div class="section-header">
                    <h2>${escapeHtml(s.title)}</h2>
                    <button class="copy-btn" onclick="copyToClipboard('pre-${s.id}')">複製內容</button>
                </div>
                <div class="section-body">
                    <pre id="pre-${s.id}">${escapeHtml(s.content)}</pre>
                </div>
            </div>
        `).join('');
        return renderHtmlTemplate(filename, navItems, contentItems, false);
    }

    // --- 報告生成 (左右並排比對) ---
    function generateSideBySideDiffReport(nameA, nameB, secsA, secsB) {
        const mapA = new Map(secsA.map(s => [s.title, s.content]));
        const mapB = new Map(secsB.map(s => [s.title, s.content]));
        
        const allTitles = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
        
        let navHtml = "";
        let contentHtml = "";

        allTitles.forEach((title, index) => {
            const contentA = mapA.get(title);
            const contentB = mapB.get(title);
            const safeId = "diff-" + index;
            
            let navMark = "";
            let badge = "";
            let diffBody = "";
            let statusClass = "";

            if (contentA === undefined) {
                statusClass = "status-added";
                badge = `<span class="badge badge-add">New in Target</span>`;
                navMark = `<span class="diff-mark add">[+]</span>`;
                diffBody = renderSideBySideTable("", contentB, "add-block");
            } else if (contentB === undefined) {
                statusClass = "status-removed";
                badge = `<span class="badge badge-del">Removed in Target</span>`;
                navMark = `<span class="diff-mark del">[-]</span>`;
                diffBody = renderSideBySideTable(contentA, "", "del-block");
            } else if (contentA !== contentB) {
                statusClass = "status-modified";
                badge = `<span class="badge badge-mod">Modified</span>`;
                navMark = `<span class="diff-mark mod">[M]</span>`;
                diffBody = computeSideBySideDiff(contentA, contentB);
            } else {
                statusClass = "status-same";
                diffBody = renderSideBySideTable(contentA, contentB, "same");
            }

            navHtml += `<a href="#${safeId}" class="nav-link">${navMark} ${escapeHtml(title)}</a>`;
            
            contentHtml += `
                <div id="${safeId}" class="section-card ${statusClass}">
                    <div class="section-header">
                        <h2>${escapeHtml(title)} ${badge}</h2>
                    </div>
                    <div class="section-body no-padding">
                        ${diffBody}
                    </div>
                </div>
            `;
        });

        return renderHtmlTemplate(`Compare: ${nameA} vs ${nameB}`, navHtml, contentHtml, true);
    }

    // --- 核心演算法：左右並排且具備 Lookahead 對齊功能 ---
    function computeSideBySideDiff(textA, textB) {
        const linesA = textA.split('\n');
        const linesB = textB.split('\n');
        
        let htmlRows = "";
        let i = 0, j = 0;
        const LOOKAHEAD = 3; 

        while (i < linesA.length || j < linesB.length) {
            let valA = linesA[i];
            let valB = linesB[j];

            if (valA === valB) {
                htmlRows += createDiffRow(i+1, valA, j+1, valB, 'neutral');
                i++; j++;
            } else {
                let foundInB = -1; 
                let foundInA = -1; 

                if (i < linesA.length) {
                    for (let k = 1; k <= LOOKAHEAD; k++) {
                        if (j + k < linesB.length && linesB[j + k] === valA) {
                            foundInB = k;
                            break;
                        }
                    }
                }

                if (j < linesB.length) {
                    for (let k = 1; k <= LOOKAHEAD; k++) {
                        if (i + k < linesA.length && linesA[i + k] === valB) {
                            foundInA = k;
                            break;
                        }
                    }
                }

                if (foundInB !== -1) {
                    htmlRows += createDiffRow(null, "", j+1, valB, 'add');
                    j++;
                } else if (foundInA !== -1) {
                    htmlRows += createDiffRow(i+1, valA, null, "", 'del');
                    i++;
                } else {
                    htmlRows += createDiffRow(i+1, valA, j+1, valB, 'mod');
                    i++; j++;
                }
            }
        }
        
        return `<div class="diff-table">${htmlRows}</div>`;
    }

    function renderSideBySideTable(fullTextA, fullTextB, type) {
        const linesA = fullTextA ? fullTextA.split('\n') : [];
        const linesB = fullTextB ? fullTextB.split('\n') : [];
        const max = Math.max(linesA.length, linesB.length);
        let html = "";
        
        for(let k=0; k<max; k++) {
            let rowType = 'neutral';
            if (type === 'add-block') rowType = 'add';
            if (type === 'del-block') rowType = 'del';
            
            let numA = (type === 'add-block') ? null : (k < linesA.length ? k+1 : null);
            let valA = (type === 'add-block') ? "" : (linesA[k] || "");
            
            let numB = (type === 'del-block') ? null : (k < linesB.length ? k+1 : null);
            let valB = (type === 'del-block') ? "" : (linesB[k] || "");

            html += createDiffRow(numA, valA, numB, valB, rowType);
        }
        return `<div class="diff-table">${html}</div>`;
    }

    function createDiffRow(numA, txtA, numB, txtB, type) {
        let clsA = "", clsB = "";
        if (type === 'add') { clsA = "empty"; clsB = "bg-add"; }
        else if (type === 'del') { clsA = "bg-del"; clsB = "empty"; }
        else if (type === 'mod') { clsA = "bg-mod-old"; clsB = "bg-mod-new"; }
        
        return `
            <div class="diff-row">
                <div class="diff-cell num">${numA || ""}</div>
                <div class="diff-cell content ${clsA}">${escapeHtml(txtA || "")}</div>
                <div class="diff-cell num">${numB || ""}</div>
                <div class="diff-cell content ${clsB}">${escapeHtml(txtB || "")}</div>
            </div>
        `;
    }

    function renderHtmlTemplate(title, navHtml, contentHtml, isDiffMode) {
        const dateStr = new Date().toLocaleString();
        
        // 注意：這裡的 CSS 是給「產出的報表」用的，必須保留在 JS 內，確保下載後的檔案是獨立完整的
        const diffCss = `
            .diff-table { display: flex; flex-direction: column; font-family: "Menlo", "Consolas", monospace; font-size: 0.85rem; width: 100%; }
            .diff-row { display: flex; border-bottom: 1px solid #f0f0f0; min-height: 1.5em; }
            .diff-row:hover { background-color: #fafafa; }
            .diff-cell { padding: 2px 4px; word-break: break-all; white-space: pre-wrap; line-height: 1.5; }
            .diff-cell.num { width: 40px; text-align: right; color: #a0aec0; border-right: 1px solid #edf2f7; user-select: none; font-size: 0.75rem; background: #fafbfc; }
            .diff-cell.content { flex: 1; border-right: 1px solid #edf2f7; width: 50%; }
            .diff-cell.content:last-child { border-right: none; }
            .bg-add { background-color: #e6fffa; color: #22543d; }
            .bg-del { background-color: #fff5f5; color: #742a2a; }
            .bg-mod-old { background-color: #fffaf0; color: #744210; text-decoration: line-through; opacity: 0.7; }
            .bg-mod-new { background-color: #fffff0; color: #744210; font-weight: bold; }
            .empty { background-color: #f7fafc; background-image: linear-gradient(45deg, #edf2f7 25%, transparent 25%, transparent 75%, #edf2f7 75%, #edf2f7), linear-gradient(45deg, #edf2f7 25%, transparent 25%, transparent 75%, #edf2f7 75%, #edf2f7); background-size: 10px 10px; background-position: 0 0, 5px 5px; }
            .badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; color: white; margin-left: 10px; vertical-align: middle; font-weight: normal; }
            .badge-add { background: #48bb78; }
            .badge-del { background: #f56565; }
            .badge-mod { background: #ed8936; }
            .diff-mark { display: inline-block; width: 20px; font-weight: bold; }
            .diff-mark.add { color: #48bb78; }
            .diff-mark.del { color: #f56565; }
            .diff-mark.mod { color: #ed8936; }
            .section-body.no-padding { padding: 0; }
        `;

        return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        :root { --sidebar-width: 320px; --primary: #2b6cb0; --bg: #f7fafc; --text: #2d3748; }
        body { margin: 0; display: flex; height: 100vh; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--text); background: var(--bg); overflow: hidden; }
        aside { width: var(--sidebar-width); background: #1a202c; color: #e2e8f0; display: flex; flex-direction: column; flex-shrink: 0; border-right: 1px solid #4a5568; }
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
        pre { margin: 0; padding: 1.5rem; font-size: 0.85rem; line-height: 1.5; color: #1a202c; white-space: pre-wrap; word-wrap: break-word; font-family: "Menlo", "Consolas", monospace; }
        ${isDiffMode ? diffCss : ''}
        @media (max-width: 1024px) { 
            body { flex-direction: column; } 
            aside { width: 100%; height: 200px; } 
        }
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
            const el = document.getElementById(id);
            if(el) {
                const text = el.innerText; 
                navigator.clipboard.writeText(text).then(() => {
                    alert('內容已複製');
                });
            }
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