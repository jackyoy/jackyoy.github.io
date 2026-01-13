document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dashboard = document.getElementById('dashboard');
    const searchInput = document.getElementById('searchInput');
    const showDiffOnly = document.getElementById('showDiffOnly');
    const downloadBtn = document.getElementById('downloadBtn'); // 新增
    
    // 全域變數儲存資料
    let reportData = [];
    let metaInfo = {}; // 新增：儲存 meta 以便打包時使用

    // --- 檔案上傳處理 ---
    if(dropZone) {
        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) processFile(e.target.files[0]);
        });

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

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt.files.length > 0) processFile(dt.files[0]);
        });
    }

    // --- 檢查是否為「離線報告模式」 ---
    // 如果全域變數 window.OFFLINE_DATA 存在，代表這是下載後的檔案，直接載入資料
    if (window.OFFLINE_DATA) {
        if(dropZone) dropZone.style.display = 'none'; // 隱藏上傳區
        dashboard.classList.remove('hidden');
        document.getElementById('downloadBtn').style.display = 'none'; // 離線版不需要再下載自己
        parseReport(window.OFFLINE_DATA, true); // true 表示不重新計算，直接用
    }

    function processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                parseReport(json);
                dashboard.classList.remove('hidden');
                if(dropZone) dropZone.style.display = 'none';
            } catch (err) {
                alert("JSON 解析失敗，請確認檔案格式正確。\n" + err.message);
            }
        };
        reader.readAsText(file);
    }

    // --- 資料解析邏輯 ---
    function parseReport(json, isOffline = false) {
        // 1. 處理 Meta
        metaInfo = json.meta || {};
        document.getElementById('metaHostname').textContent = metaInfo.hostname || 'Unknown';
        
        const scanTime = metaInfo.scan_time_final 
            ? new Date(metaInfo.scan_time_final).toLocaleString() 
            : 'Unknown';
        document.getElementById('metaTime').textContent = scanTime;

        // 2. 轉換 Results (若是離線版，資料結構可能已經處理過，視實作而定)
        // 這裡我們統一假設傳入的 json 結構都一樣 (即原始結構)
        reportData = [];
        if (json.results) {
            Object.keys(json.results).forEach(key => {
                const item = json.results[key];
                const id = key.replace('.yml', '');
                const hasDiff = String(item.before).trim() !== String(item.after).trim();
                reportData.push({
                    id: id,
                    description: item.description,
                    before: item.before,
                    after: item.after,
                    expected: item.expected,
                    status: item.status,
                    hasDiff: hasDiff
                });
            });
        }

        // 3. 計算統計
        const total = reportData.length;
        const fixedCount = reportData.filter(d => d.status === 'FIXED').length;
        document.getElementById('metaTotal').textContent = total;
        document.getElementById('metaFixed').textContent = fixedCount;

        // 4. 渲染
        renderTable(reportData);
    }

    // --- 渲染表格 ---
    function renderTable(data) {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">無符合資料</td></tr>';
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            let badgeClass = 'badge-ok';
            if (item.status === 'FIXED') badgeClass = 'badge-fixed';
            if (item.status === 'FAILED') badgeClass = 'badge-failed';

            let beforeHtml = escapeHtml(item.before);
            let afterHtml = escapeHtml(item.after);
            let beforeClass = "diff-cell";
            let afterClass = "diff-cell";

            if (item.hasDiff) {
                beforeClass += " diff-highlight";
                afterClass += " diff-highlight";
                beforeHtml = `<span class="val-old">${beforeHtml}</span>`;
                afterHtml = `<span class="val-new">${afterHtml}</span>`;
            }

            tr.innerHTML = `
                <td class="id-col">${item.id}</td>
                <td>${escapeHtml(item.description)}<br><small style="color:#94a3b8">Expected: ${escapeHtml(item.expected)}</small></td>
                <td class="${beforeClass}">${beforeHtml}</td>
                <td class="${afterClass}">${afterHtml}</td>
                <td><span class="badge ${badgeClass}">${item.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- 搜尋與過濾 ---
    function filterData() {
        const term = searchInput.value.toLowerCase();
        const onlyDiff = showDiffOnly.checked;

        const filtered = reportData.filter(item => {
            const matchSearch = item.id.toLowerCase().includes(term) || 
                                item.description.toLowerCase().includes(term);
            const matchDiff = onlyDiff ? item.hasDiff : true;
            return matchSearch && matchDiff;
        });
        renderTable(filtered);
    }

    searchInput.addEventListener('input', filterData);
    showDiffOnly.addEventListener('change', filterData);

    // --- 下載離線報告功能 ---
    if(downloadBtn) {
        downloadBtn.addEventListener('click', generateOfflineReport);
    }

    function generateOfflineReport() {
        // 1. 取得目前的 CSS
        // 在正式環境建議 fetch gcb.css，這邊為了簡化，假設樣式單純
        // 我們嘗試讀取 document.styleSheets (跨域可能會擋)，最穩是用 fetch
        fetch('gcb.css')
            .then(res => res.text())
            .then(cssContent => {
                createHtmlBlob(cssContent);
            })
            .catch(err => {
                console.warn("無法讀取外部 CSS，將使用基本樣式", err);
                createHtmlBlob(""); 
            });
    }

    function createHtmlBlob(cssContent) {
        // 2. 準備資料
        // 我們需要重建原始 JSON 結構，以便重用 parseReport 邏輯
        // 或者更簡單：直接存 window.OFFLINE_DATA
        const dataToSave = {
            meta: metaInfo,
            results: {}
        };
        // 還原 results 物件結構
        reportData.forEach(item => {
            dataToSave.results[item.id + ".yml"] = {
                description: item.description,
                before: item.before,
                after: item.after,
                expected: item.expected,
                status: item.status
            };
        });

        // 3. 取得目前的 JS 程式碼 (把自己包進去)
        const jsContent = document.querySelector('script[src="gcb.js"]') ? 
            // 這裡無法直接讀取 src 內容，除非 fetch。
            // 為了確保離線可用，我們將目前的邏輯封裝成字串。
            // 但最簡單的方法是：把目前的資料注入到 HTML 模板中，並附上精簡版的渲染腳本。
            // 下面這個 scriptContent 是為了離線版專用的精簡腳本。
            getOfflineScript() : "";

        // 4. 組合 HTML
        const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>GCB Report - ${metaInfo.hostname || 'Offline'}</title>
    <style>
        ${cssContent}
        /* 確保隱藏上傳區與下載鈕 */
        .upload-area { display: none !important; }
        #downloadBtn { display: none !important; }
        #dashboard { display: block !important; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>GCB 系統強化差異分析 (離線版)</h1>
            <p>Generated at: ${new Date().toLocaleString()}</p>
        </header>

        <div id="dashboard">
            <div class="meta-grid">
                <div class="card meta-card"><div class="label">主機名稱</div><div class="value" id="metaHostname"></div></div>
                <div class="card meta-card"><div class="label">掃描時間</div><div class="value" id="metaTime"></div></div>
                <div class="card meta-card"><div class="label">總項目</div><div class="value" id="metaTotal"></div></div>
                <div class="card meta-card"><div class="label">已修復</div><div class="value highlight-fixed" id="metaFixed"></div></div>
            </div>

            <div class="controls">
                <input type="text" id="searchInput" placeholder="搜尋 ID 或描述..." class="search-box">
                <div class="filter-group">
                    <label><input type="checkbox" id="showDiffOnly"> 僅顯示有差異項目</label>
                </div>
            </div>

            <div class="table-container">
                <table id="reportTable">
                    <thead>
                        <tr><th width="10%">ID</th><th width="35%">描述</th><th width="20%">強化前</th><th width="20%">強化後</th><th width="10%">狀態</th></tr>
                    </thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        // 注入資料
        window.OFFLINE_DATA = ${JSON.stringify(dataToSave)};
        
        // 注入邏輯
        ${jsContent}
    <\/script>
</body>
</html>`;

        // 5. 下載
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GCB_Report_${metaInfo.hostname}_${new Date().toISOString().slice(0,10)}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function getOfflineScript() {
        // 回傳必要的 JS 邏輯字串 (複製上述核心功能)
        // 為了避免重複維護，這裡將包含一個自執行函數，內容為縮減版邏輯
        return `
        document.addEventListener('DOMContentLoaded', () => {
            const searchInput = document.getElementById('searchInput');
            const showDiffOnly = document.getElementById('showDiffOnly');
            let reportData = [];
            
            if (window.OFFLINE_DATA) {
                parseReport(window.OFFLINE_DATA);
            }

            function parseReport(json) {
                const meta = json.meta || {};
                document.getElementById('metaHostname').textContent = meta.hostname || '-';
                document.getElementById('metaTime').textContent = meta.scan_time_final ? new Date(meta.scan_time_final).toLocaleString() : '-';
                
                reportData = [];
                if (json.results) {
                    Object.keys(json.results).forEach(key => {
                        const item = json.results[key];
                        const id = key.replace('.yml', '');
                        const hasDiff = String(item.before).trim() !== String(item.after).trim();
                        reportData.push({ ...item, id, hasDiff });
                    });
                }
                
                document.getElementById('metaTotal').textContent = reportData.length;
                document.getElementById('metaFixed').textContent = reportData.filter(d => d.status === 'FIXED').length;
                
                renderTable(reportData);
            }

            function renderTable(data) {
                const tbody = document.getElementById('tableBody');
                tbody.innerHTML = '';
                if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px">無資料</td></tr>'; return; }
                
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    let badge = item.status === 'FIXED' ? 'badge-fixed' : (item.status === 'FAILED' ? 'badge-failed' : 'badge-ok');
                    
                    let bHtml = esc(item.before), aHtml = esc(item.after);
                    let bCls = 'diff-cell', aCls = 'diff-cell';
                    if(item.hasDiff) {
                        bCls += ' diff-highlight'; aCls += ' diff-highlight';
                        bHtml = '<span class="val-old">'+bHtml+'</span>';
                        aHtml = '<span class="val-new">'+aHtml+'</span>';
                    }
                    
                    tr.innerHTML = \`
                        <td class="id-col">\${item.id}</td>
                        <td>\${esc(item.description)}<br><small style="color:#94a3b8">Exp: \${esc(item.expected)}</small></td>
                        <td class="\${bCls}">\${bHtml}</td>
                        <td class="\${aCls}">\${aHtml}</td>
                        <td><span class="badge \${badge}">\${item.status}</span></td>
                    \`;
                    tbody.appendChild(tr);
                });
            }

            function filter() {
                const term = searchInput.value.toLowerCase();
                const onlyDiff = showDiffOnly.checked;
                const res = reportData.filter(d => (d.id.toLowerCase().includes(term) || d.description.toLowerCase().includes(term)) && (!onlyDiff || d.hasDiff));
                renderTable(res);
            }

            searchInput.addEventListener('input', filter);
            showDiffOnly.addEventListener('change', filter);

            function esc(t) {
                if(t==null) return "";
                return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            }
        });
        `;
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
});