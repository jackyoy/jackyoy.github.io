document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileListDiv = document.getElementById('fileList');
    const actionBtn = document.getElementById('actionBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusDiv = document.getElementById('status');
    const dropZoneText = document.getElementById('dropZoneText');

    let uploadedFiles = []; // 存放 File 物件
    let downloadUrl = null;

    // --- UI: 拖放與選擇處理 ---
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

    function handleFiles(files) {
        if (!files || files.length === 0) return;
        
        // 將 FileList 轉為 Array 並加入總清單
        Array.from(files).forEach(f => uploadedFiles.push(f));
        
        updateUI();
    }

    resetBtn.addEventListener('click', () => {
        uploadedFiles = [];
        fileInput.value = '';
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
        fileListDiv.innerHTML = '';
        dropZoneText.textContent = "點擊選擇或拖曳多個檔案至此";
        resetBtn.style.display = 'none';
        actionBtn.textContent = "請至少上傳兩個檔案";
        actionBtn.classList.remove('download');
        actionBtn.disabled = true;
        statusDiv.textContent = "";
    });

    function updateUI() {
        fileListDiv.innerHTML = '';
        uploadedFiles.forEach((f, idx) => {
            const tag = document.createElement('div');
            tag.className = 'file-tag';
            tag.innerHTML = `<span class="count">${idx + 1}</span> ${f.name}`;
            fileListDiv.appendChild(tag);
        });

        if (uploadedFiles.length > 0) {
            dropZoneText.textContent = `已載入 ${uploadedFiles.length} 個檔案`;
        }

        if (uploadedFiles.length >= 2) {
            actionBtn.disabled = false;
            actionBtn.textContent = "生成多重比對互動報告";
        } else {
            actionBtn.disabled = true;
            actionBtn.textContent = "請至少上傳兩個檔案";
        }
    }

    // --- 核心: 打包與生成 ---
    actionBtn.addEventListener('click', () => {
        if (actionBtn.classList.contains('download')) {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `Multi_Log_Report_${new Date().toISOString().slice(0,10)}.html`;
            a.click();
        } else {
            statusDiv.textContent = "正在解析所有檔案並建構報告資料庫...";
            actionBtn.disabled = true;
            setTimeout(processAndPackage, 100);
        }
    });

    async function processAndPackage() {
        try {
            // 1. 讀取並解析所有檔案
            const fileDataPromises = uploadedFiles.map(async (file) => {
                const text = await readFileContent(file);
                const sections = parseLog(text);
                return {
                    name: file.name,
                    sections: sections
                };
            });

            const allLogs = await Promise.all(fileDataPromises);

            // 2. 將資料序列化為 JSON
            const datasetJson = JSON.stringify(allLogs);

            // 3. 生成包含互動邏輯的 HTML
            const finalHtml = generateInteractiveHtml(datasetJson);

            // 4. 準備下載
            const blob = new Blob([finalHtml], { type: 'text/html' });
            downloadUrl = URL.createObjectURL(blob);

            actionBtn.textContent = "下載互動式報告 HTML";
            actionBtn.classList.add('download');
            actionBtn.disabled = false;
            resetBtn.style.display = 'block';
            statusDiv.textContent = "報告生成完畢！請下載後開啟。";

        } catch (err) {
            console.error(err);
            statusDiv.textContent = "錯誤: " + err.message;
            actionBtn.disabled = false;
        }
    }

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                let text = e.target.result;
                if (file.name.match(/\.html?$/i)) text = extractTextFromHtml(text);
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
        // 簡易解析邏輯，與之前相同
        const regexDiag = /={50,}\n\s*\[ SECTION \] (.*?)\n={50,}\n/g; 
        const regexStatic = /={50,}\n說明:\s*(.*?)\n指令:\s*(.*?)\n-{50,}\n/g;
        let regex = regexDiag;
        let isStaticFormat = false;
        if (text.search(regexStatic) !== -1) { regex = regexStatic; isStaticFormat = true; }

        const sections = [];
        let lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const title = match[1].trim();
            const startIndex = match.index;
            if (startIndex > lastIndex) {
                let content = text.substring(lastIndex, startIndex).trim();
                if (content || sections.length > 0) {
                   // 處理 header 或上一個區塊的結尾
                   if(sections.length === 0) sections.push({title:"Header", content: content});
                   else sections[sections.length-1].content += "\n" + content;
                }
            }
            sections.push({ title: title, content: "" });
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
            const content = text.substring(lastIndex).trim();
            if(sections.length > 0) sections[sections.length-1].content = content;
        }
        return sections;
    }

    // ==========================================
    // 這裡開始是「生成報告」的關鍵
    // 我們需要把 Diff 算法和 UI 邏輯以「字串」形式寫入模板
    // ==========================================
    
    function generateInteractiveHtml(datasetJson) {
        // 內嵌的 CSS
        const embeddedCss = `
            :root { --primary: #2b6cb0; --bg: #f7fafc; --sidebar-w: 300px; }
            body { margin: 0; display: flex; flex-direction: column; height: 100vh; font-family: "Segoe UI", sans-serif; background: var(--bg); overflow: hidden; }
            
            /* 頂部控制列 */
            header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 10px 20px; display: flex; align-items: center; gap: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); z-index: 20; height: 60px; flex-shrink: 0; }
            .control-group { display: flex; align-items: center; gap: 10px; }
            label { font-size: 0.85rem; font-weight: bold; color: #4a5568; }
            select { padding: 6px 12px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.9rem; min-width: 200px; }
            .vs-badge { background: #e2e8f0; color: #718096; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; }
            
            /* 主佈局 */
            .layout { display: flex; flex: 1; overflow: hidden; }
            aside { width: var(--sidebar-w); background: #1a202c; color: #cbd5e0; display: flex; flex-direction: column; border-right: 1px solid #4a5568; }
            .nav-list { flex: 1; overflow-y: auto; }
            .nav-item { padding: 10px 15px; border-bottom: 1px solid #2d3748; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; }
            .nav-item:hover { background: #2d3748; color: white; }
            .nav-item.active { background: #2b6cb0; color: white; border-left: 4px solid #63b3ed; }
            .diff-mark { margin-right: 8px; font-family: monospace; font-weight: bold; width: 20px; }
            .diff-mark.mod { color: #ed8936; } .diff-mark.add { color: #48bb78; } .diff-mark.del { color: #f56565; }
            
            main { flex: 1; overflow-y: auto; padding: 20px; scroll-behavior: smooth; position: relative; }
            .section-card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; border: 1px solid #e2e8f0; }
            .card-header { background: #edf2f7; padding: 10px 20px; font-weight: bold; color: #2d3748; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
            
            /* Diff Table */
            .diff-table { display: flex; flex-direction: column; font-family: "Menlo", monospace; font-size: 0.85rem; width: 100%; }
            .diff-row { display: flex; border-bottom: 1px solid #f0f0f0; min-height: 1.5em; }
            .diff-row:hover { background: #fafafa; }
            .diff-cell { padding: 2px 5px; word-break: break-all; white-space: pre-wrap; line-height: 1.5; }
            .num { width: 40px; text-align: right; color: #a0aec0; background: #fafbfc; border-right: 1px solid #edf2f7; user-select: none; flex-shrink: 0; }
            .content { flex: 1; width: 50%; }
            .bg-add { background: #e6fffa; color: #044230; }
            .bg-del { background: #fff5f5; color: #742a2a; }
            .empty { background: #f7fafc; opacity: 0.5; }
        `;

        // 內嵌的 JS 邏輯 (包含 Myers Diff 與 UI 控制)
        const clientScript = `
            const LOG_DATA = ${datasetJson};

            document.addEventListener('DOMContentLoaded', () => {
                const selA = document.getElementById('selectA');
                const selB = document.getElementById('selectB');
                
                // 初始化選單
                LOG_DATA.forEach((log, idx) => {
                    const optA = new Option(log.name, idx);
                    const optB = new Option(log.name, idx);
                    selA.add(optA);
                    selB.add(optB);
                });
                
                // 預設選第一和第二個
                if(LOG_DATA.length > 1) selB.value = 1;

                function render() {
                    const idxA = parseInt(selA.value);
                    const idxB = parseInt(selB.value);
                    const logA = LOG_DATA[idxA];
                    const logB = LOG_DATA[idxB];
                    
                    doDiffAndRender(logA, logB);
                }

                selA.addEventListener('change', render);
                selB.addEventListener('change', render);
                
                // 初次渲染
                render();
            });

            function doDiffAndRender(logA, logB) {
                const navList = document.getElementById('navList');
                const mainArea = document.getElementById('mainArea');
                navList.innerHTML = '';
                mainArea.innerHTML = '';

                const mapA = new Map(logA.sections.map(s => [s.title, s.content]));
                const mapB = new Map(logB.sections.map(s => [s.title, s.content]));
                const allTitles = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

                allTitles.forEach((title, i) => {
                    const cA = mapA.get(title);
                    const cB = mapB.get(title);
                    const id = 'sec-' + i;
                    
                    let status = '', mark = '';
                    let diffHtml = '';

                    if (cA === undefined) {
                        status = 'add'; mark = '[+]';
                        diffHtml = renderDiffRows([{type:'block-add', text:cB}]);
                    } else if (cB === undefined) {
                        status = 'del'; mark = '[-]';
                        diffHtml = renderDiffRows([{type:'block-del', text:cA}]);
                    } else if (cA !== cB) {
                        status = 'mod'; mark = '[M]';
                        const script = myersDiff(cA.split('\\n'), cB.split('\\n'));
                        diffHtml = renderDiffRows(script);
                    } else {
                        status = 'same';
                        diffHtml = renderDiffRows([{type:'block-same', text:cA}]);
                    }

                    // Render Nav
                    const navItem = document.createElement('div');
                    navItem.className = 'nav-item';
                    if(status !== 'same') navItem.innerHTML = \`<span class="diff-mark \${status}">\${mark}</span> \${title}\`;
                    else navItem.innerText = title;
                    
                    navItem.onclick = () => {
                        document.getElementById(id).scrollIntoView();
                        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                        navItem.classList.add('active');
                    };
                    navList.appendChild(navItem);

                    // Render Card
                    const card = document.createElement('div');
                    card.className = 'section-card';
                    card.id = id;
                    card.innerHTML = \`
                        <div class="card-header">
                            <span>\${title}</span>
                            <span style="font-size:0.8rem; color:#718096">\${status.toUpperCase()}</span>
                        </div>
                        <div class="diff-table">\${diffHtml}</div>
                    \`;
                    mainArea.appendChild(card);
                });
            }

            // --- Myers Diff Algorithm (Embedded) ---
            function myersDiff(linesA, linesB) {
                const N = linesA.length;
                const M = linesB.length;
                const max = N + M;
                const v = new Int32Array(2 * max + 1);
                v[max + 1] = 0;
                const trace = [];
                for (let d = 0; d <= max; d++) {
                    const vClone = new Int32Array(v);
                    trace.push(vClone);
                    for (let k = -d; k <= d; k += 2) {
                        let x, y;
                        if (k === -d || (k !== d && v[max + k - 1] < v[max + k + 1])) {
                            x = v[max + k + 1];
                        } else {
                            x = v[max + k - 1] + 1;
                        }
                        y = x - k;
                        while (x < N && y < M && linesA[x] === linesB[y]) { x++; y++; }
                        v[max + k] = x;
                        if (x >= N && y >= M) return buildScript(trace, linesA, linesB);
                    }
                }
                return [];
            }

            function buildScript(trace, linesA, linesB) {
                const N = linesA.length; const M = linesB.length; const max = N + M;
                let x = N; let y = M; let changes = [];
                for (let d = trace.length - 1; d >= 0; d--) {
                    const v = trace[d]; const k = x - y;
                    let prevK = (k === -d || (k !== d && v[max + k - 1] < v[max + k + 1])) ? k + 1 : k - 1;
                    let prevX = v[max + prevK]; let prevY = prevX - prevK;
                    while (x > prevX && y > prevY) { changes.unshift({type:'eq', lineA:x, lineB:y, txt:linesA[x-1]}); x--; y--; }
                    if (d > 0) {
                        if (x === prevX) { changes.unshift({type:'ins', lineB:y, txt:linesB[y-1]}); y--; }
                        else { changes.unshift({type:'del', lineA:x, txt:linesA[x-1]}); x--; }
                    }
                }
                return changes;
            }

            function renderDiffRows(script) {
                let html = '';
                script.forEach(item => {
                    if(item.type==='eq') html += row(item.lineA, item.txt, item.lineB, item.txt, '');
                    else if(item.type==='ins') html += row('', '', item.lineB, item.txt, 'ins');
                    else if(item.type==='del') html += row(item.lineA, item.txt, '', '', 'del');
                    else if(item.type==='block-same') item.text.split('\\n').forEach((t,i)=> html+=row(i+1,t,i+1,t,''));
                    else if(item.type==='block-add') item.text.split('\\n').forEach((t,i)=> html+=row('','',i+1,t,'ins'));
                    else if(item.type==='block-del') item.text.split('\\n').forEach((t,i)=> html+=row(i+1,t,'','','del'));
                });
                return html;
            }

            function row(nA, tA, nB, tB, type) {
                let cA = '', cB = '';
                if(type==='ins') { cA='empty'; cB='bg-add'; }
                if(type==='del') { cA='bg-del'; cB='empty'; }
                return \`<div class="diff-row"><div class="num">\${nA}</div><div class="diff-cell content \${cA}">\${esc(tA)}</div><div class="num">\${nB}</div><div class="diff-cell content \${cB}">\${esc(tB)}</div></div>\`;
            }

            function esc(t) { if(!t) return ""; return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
        `;

        return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>Multi-Log Interactive Report</title>
    <style>${embeddedCss}</style>
</head>
<body>
    <header>
        <div class="control-group">
            <label>基準 (Base):</label>
            <select id="selectA"></select>
        </div>
        <div class="vs-badge">VS</div>
        <div class="control-group">
            <label>對照 (Target):</label>
            <select id="selectB"></select>
        </div>
    </header>
    <div class="layout">
        <aside id="navList"></aside>
        <main id="mainArea">
            <div style="text-align:center; padding:50px; color:#a0aec0;">正在進行比對運算...</div>
        </main>
    </div>
    <script>${clientScript}<\/script>
</body>
</html>`;
    }
});