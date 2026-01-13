document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dashboard = document.getElementById('dashboard');
    const searchInput = document.getElementById('searchInput');
    const showDiffOnly = document.getElementById('showDiffOnly');
    const downloadBtn = document.getElementById('downloadBtn');
    
    // 全域變數儲存資料
    let reportData = [];
    let metaInfo = {}; 

    // --- 1. 介面與事件綁定 ---
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

    // --- 2. 檢查是否為「離線報告模式」 ---
    if (window.OFFLINE_DATA) {
        if(dropZone) dropZone.style.display = 'none';
        dashboard.classList.remove('hidden');
        if(downloadBtn) downloadBtn.style.display = 'none';
        parseReport(window.OFFLINE_DATA);
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

    // --- 3. 資料解析邏輯 ---
    function parseReport(json) {
        metaInfo = json.meta || {};
        document.getElementById('metaHostname').textContent = metaInfo.hostname || 'Unknown';
        
        const scanTime = metaInfo.scan_time_final 
            ? new Date(metaInfo.scan_time_final).toLocaleString() 
            : 'Unknown';
        document.getElementById('metaTime').textContent = scanTime;

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

        const total = reportData.length;
        const fixedCount = reportData.filter(d => d.status === 'FIXED').length;
        document.getElementById('metaTotal').textContent = total;
        document.getElementById('metaFixed').textContent = fixedCount;

        renderTable(reportData);
    }

    // --- 4. 渲染表格 ---
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
                <td>${escapeHtml(item.description)}<br><small style="color:#94a3b8">Exp: ${escapeHtml(item.expected)}</small></td>
                <td class="${beforeClass}">${beforeHtml}</td>
                <td class="${afterClass}">${afterHtml}</td>
                <td><span class="badge ${badgeClass}">${item.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- 5. 搜尋與過濾 ---
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

    // --- 6. 下載離線報告功能 (核心修正) ---
    if(downloadBtn) {
        downloadBtn.addEventListener('click', generateOfflineReport);
    }

    function generateOfflineReport() {
        // [修正] 不使用 fetch('gcb.css')，改為直接定義 CSS 字串
        // 這樣可以避免 local file CORS 錯誤
        const cssContent = `
            :root { --primary: #2563eb; --bg: #f8fafc; --card-bg: #ffffff; --text-main: #1e293b; --text-sub: #64748b; --border: #e2e8f0; --status-ok-bg: #dcfce7; --status-ok-text: #166534; --status-fixed-bg: #dbeafe; --status-fixed-text: #1e40af; --status-failed-bg: #fee2e2; --status-failed-text: #991b1b; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: var(--bg); color: var(--text-main); margin: 0; padding: 20px; line-height: 1.5; }
            .container { max-width: 1200px; margin: 0 auto; }
            header { text-align: center; margin-bottom: 30px; }
            .hidden { display: none; }
            .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .card { background: var(--card-bg); padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid var(--border); }
            .meta-card .label { font-size: 0.85rem; color: var(--text-sub); margin-bottom: 5px; font-weight: 600; }
            .meta-card .value { font-size: 1.25rem; font-weight: bold; color: var(--text-main); word-break: break-all; }
            .highlight-fixed { color: var(--primary); }
            .controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; }
            .search-box { padding: 10px; border: 1px solid var(--border); border-radius: 6px; width: 300px; }
            .table-container { background: var(--card-bg); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; border: 1px solid var(--border); }
            table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); }
            th { background-color: #f1f5f9; font-weight: 600; color: var(--text-sub); position: sticky; top: 0; }
            .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; display: inline-block; min-width: 60px; text-align: center; }
            .badge-ok { background: var(--status-ok-bg); color: var(--status-ok-text); }
            .badge-fixed { background: var(--status-fixed-bg); color: var(--status-fixed-text); }
            .badge-failed { background: var(--status-failed-bg); color: var(--status-failed-text); }
            .diff-cell { font-family: "Menlo", monospace; font-size: 0.85rem; }
            .val-old { color: #94a3b8; text-decoration: line-through; display: block; font-size: 0.8em; margin-bottom: 4px; }
            .val-new { color: var(--text-main); font-weight: 600; }
            .diff-highlight .val-old { color: #ef4444; background: #fff5f5; padding: 2px 4px; border-radius: 2px; text-decoration: none; opacity: 0.8; }
            .diff-highlight .val-old::before { content: "- "; }
            .diff-highlight .val-new { color: #166534; background: #f0fdf4; padding: 2px 4px; border-radius: 2px; }
            .diff-highlight .val-new::before { content: "+ "; }
            .id-col { font-family: monospace; font-weight: 600; color: var(--text-sub); }
            .upload-area { display: none !important; } /* 離線版強制隱藏上傳區 */
            #downloadBtn { display: none !important; } /* 離線版強制隱藏下載鈕 */
        `;

        createHtmlBlob(cssContent);
    }

    function createHtmlBlob(cssContent) {
        // 準備要儲存的資料
        const dataToSave = {
            meta: metaInfo,
            results: {}
        };
        reportData.forEach(item => {
            dataToSave.results[item.id + ".yml"] = {
                description: item.description,
                before: item.before,
                after: item.after,
                expected: item.expected,
                status: item.status
            };
        });

        const jsContent = getOfflineScript();

        const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>GCB Report - ${metaInfo.hostname || 'Offline'}</title>
    <style>${cssContent}</style>
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
        window.OFFLINE_DATA = ${JSON.stringify(dataToSave)};
        ${jsContent}
    <\/script>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GCB_Report_${metaInfo.hostname}_${new Date().toISOString().slice(0,10)}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function getOfflineScript() {
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

            if(searchInput) searchInput.addEventListener('input', filter);
            if(showDiffOnly) showDiffOnly.addEventListener('change', filter);

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