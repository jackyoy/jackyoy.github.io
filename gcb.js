document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素參考
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dashboard = document.getElementById('dashboard');
    const searchInput = document.getElementById('searchInput');
    const showDiffOnly = document.getElementById('showDiffOnly');
    const downloadBtn = document.getElementById('downloadBtn');

    // 資料儲存
    let reportData = [];
    let metaInfo = {};

    // --- 1. 初始化與事件監聽 ---
    
    // 如果是「離線報告模式」(window.OFFLINE_DATA 存在)，直接渲染
    if (window.OFFLINE_DATA) {
        if (dropZone) dropZone.remove(); // 移除上傳區
        if (downloadBtn) downloadBtn.remove(); // 移除下載按鈕
        dashboard.classList.remove('hidden');
        parseReport(window.OFFLINE_DATA);
    } else {
        // 否則啟用上傳功能
        setupUpload();
    }

    function setupUpload() {
        if(!dropZone) return;
        
        dropZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) processFile(e.target.files[0]);
        });

        // 拖曳效果
        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
        });
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt.files.length > 0) processFile(dt.files[0]);
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', generateOfflineReport);
    }

    // 綁定搜尋與篩選事件
    if (searchInput) searchInput.addEventListener('input', filterData);
    if (showDiffOnly) showDiffOnly.addEventListener('change', filterData);


    // --- 2. 檔案處理與解析 ---

    function processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                parseReport(json);
                dashboard.classList.remove('hidden');
                dropZone.classList.add('hidden'); // 隱藏上傳區
            } catch (err) {
                alert("JSON 解析失敗: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    function parseReport(json) {
        metaInfo = json.meta || {};
        
        // 填寫 Meta
        setText('metaHostname', metaInfo.hostname || '-');
        setText('metaTime', metaInfo.scan_time_final ? new Date(metaInfo.scan_time_final).toLocaleString() : '-');

        // 解析 Results
        reportData = [];
        if (json.results) {
            Object.keys(json.results).forEach(key => {
                const item = json.results[key];
                const id = key.replace('.yml', ''); // 移除副檔名
                // 判斷是否有差異
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

        // 填寫統計
        setText('metaTotal', reportData.length);
        setText('metaFixed', reportData.filter(d => d.status === 'FIXED').length);

        // 渲染初始表格
        renderTable(reportData);
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if(el) el.textContent = text;
    }

    // --- 3. 表格渲染 (核心視覺邏輯) ---

    function renderTable(data) {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: #999;">無符合資料</td></tr>';
            return;
        }

        const fragment = document.createDocumentFragment();

        data.forEach(item => {
            const tr = document.createElement('tr');
            
            // 狀態徽章
            let badgeClass = 'badge-ok';
            if (item.status === 'FIXED') badgeClass = 'badge-fixed';
            if (item.status === 'FAILED') badgeClass = 'badge-failed';

            // 差異處理
            let beforeHtml = escapeHtml(item.before);
            let afterHtml = escapeHtml(item.after);
            let cellClass = "diff-cell";

            if (item.hasDiff) {
                cellClass += " diff-highlight";
                beforeHtml = `<span class="val-old">${beforeHtml}</span>`;
                afterHtml = `<span class="val-new">${afterHtml}</span>`;
            }

            tr.innerHTML = `
                <td class="id-text">${item.id}</td>
                <td>
                    <div>${escapeHtml(item.description)}</div>
                    <div style="font-size: 0.8em; color: #64748b; margin-top: 4px;">Expected: ${escapeHtml(item.expected)}</div>
                </td>
                <td class="${cellClass}">${beforeHtml}</td>
                <td class="${cellClass}">${afterHtml}</td>
                <td style="text-align: center;"><span class="badge ${badgeClass}">${item.status}</span></td>
            `;
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    }

    function filterData() {
        const term = searchInput.value.toLowerCase();
        const onlyDiff = showDiffOnly.checked;

        const filtered = reportData.filter(item => {
            const matchText = item.id.toLowerCase().includes(term) || item.description.toLowerCase().includes(term);
            const matchDiff = onlyDiff ? item.hasDiff : true;
            return matchText && matchDiff;
        });
        renderTable(filtered);
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return "";
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // --- 4. 離線報告生成 (打包) ---

    function generateOfflineReport() {
        // 為了確保下載後的檔案樣式正確，我們在此定義 CSS 字串
        // 這樣就不需要依賴外部 CSS 檔案，避免 CORS 或路徑錯誤
        const cssContent = `
            :root { --primary: #2563eb; --bg: #f8fafc; --card-bg: #ffffff; --text-main: #1e293b; --text-sub: #64748b; --border: #e2e8f0; --status-ok-bg: #dcfce7; --status-ok-text: #166534; --status-fixed-bg: #dbeafe; --status-fixed-text: #1e40af; --status-failed-bg: #fee2e2; --status-failed-text: #991b1b; }
            body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: var(--bg); color: var(--text-main); margin: 0; padding: 20px; line-height: 1.5; }
            .container { max-width: 1400px; margin: 0 auto; }
            header { text-align: center; margin-bottom: 30px; }
            .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
            .card { background: var(--card-bg); padding: 15px 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid var(--border); }
            .meta-card .label { font-size: 0.85rem; color: var(--text-sub); font-weight: 600; margin-bottom: 5px; }
            .meta-card .value { font-size: 1.2rem; font-weight: bold; color: var(--text-main); }
            .highlight-fixed { color: var(--primary); }
            .controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px; flex-wrap: wrap; }
            .search-box { padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; width: 300px; }
            .table-container { background: var(--card-bg); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; border: 1px solid var(--border); }
            table { width: 100%; border-collapse: collapse; font-size: 0.9rem; table-layout: fixed; }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; word-wrap: break-word; }
            th { background-color: #f1f5f9; font-weight: 600; color: var(--text-sub); position: sticky; top: 0; z-index: 10; }
            .col-id { width: 10%; } .col-desc { width: 30%; } .col-val { width: 25%; } .col-status { width: 10%; text-align: center; }
            .id-text { font-family: monospace; font-weight: bold; color: var(--text-sub); }
            .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; display: inline-block; min-width: 60px; text-align: center; }
            .badge-ok { background: var(--status-ok-bg); color: var(--status-ok-text); }
            .badge-fixed { background: var(--status-fixed-bg); color: var(--status-fixed-text); }
            .badge-failed { background: var(--status-failed-bg); color: var(--status-failed-text); }
            .diff-cell { font-family: "Menlo", monospace; font-size: 0.85rem; line-height: 1.6; }
            .val-old { color: #94a3b8; text-decoration: line-through; display: block; font-size: 0.85em; margin-bottom: 4px; }
            .val-new { color: var(--text-main); font-weight: 600; display: block; }
            .diff-highlight .val-old { color: #ef4444; background: #fff5f5; padding: 2px 6px; border-radius: 4px; text-decoration: none; opacity: 0.8; width: fit-content; }
            .diff-highlight .val-old::before { content: "- "; }
            .diff-highlight .val-new { color: #166534; background: #f0fdf4; padding: 2px 6px; border-radius: 4px; width: fit-content; }
            .diff-highlight .val-new::before { content: "+ "; }
            .upload-area, #downloadBtn { display: none !important; } /* 隱藏離線版不用的元素 */
        `;

        // 準備資料
        const dataToSave = { meta: metaInfo, results: {} };
        reportData.forEach(item => {
            dataToSave.results[item.id + ".yml"] = {
                description: item.description,
                before: item.before,
                after: item.after,
                expected: item.expected,
                status: item.status
            };
        });

        // 嵌入的精簡腳本 (確保下載後能動)
        const scriptContent = `
            document.addEventListener('DOMContentLoaded', () => {
                const searchInput = document.getElementById('searchInput');
                const showDiffOnly = document.getElementById('showDiffOnly');
                let reportData = [];
                
                if (window.OFFLINE_DATA) parseReport(window.OFFLINE_DATA);

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
                    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:#999">無資料</td></tr>'; return; }
                    
                    const frag = document.createDocumentFragment();
                    data.forEach(item => {
                        const tr = document.createElement('tr');
                        let badge = item.status === 'FIXED' ? 'badge-fixed' : (item.status === 'FAILED' ? 'badge-failed' : 'badge-ok');
                        
                        let bHtml = esc(item.before), aHtml = esc(item.after);
                        let cellCls = 'diff-cell';
                        if(item.hasDiff) {
                            cellCls += ' diff-highlight';
                            bHtml = '<span class="val-old">'+bHtml+'</span>';
                            aHtml = '<span class="val-new">'+aHtml+'</span>';
                        }
                        
                        tr.innerHTML = \`
                            <td class="id-text">\${item.id}</td>
                            <td><div>\${esc(item.description)}</div><div style="font-size:0.8em;color:#64748b;margin-top:4px">Expected: \${esc(item.expected)}</div></td>
                            <td class="\${cellCls}">\${bHtml}</td>
                            <td class="\${cellCls}">\${aHtml}</td>
                            <td style="text-align:center"><span class="badge \${badge}">\${item.status}</span></td>
                        \`;
                        frag.appendChild(tr);
                    });
                    tbody.appendChild(frag);
                }

                function filter() {
                    const term = searchInput.value.toLowerCase();
                    const onlyDiff = showDiffOnly.checked;
                    const res = reportData.filter(d => (d.id.toLowerCase().includes(term) || d.description.toLowerCase().includes(term)) && (!onlyDiff || d.hasDiff));
                    renderTable(res);
                }

                searchInput.addEventListener('input', filter);
                showDiffOnly.addEventListener('change', filter);
                function esc(t) { return t == null ? "" : String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
            });
        `;

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
                <div class="filter-group"><label><input type="checkbox" id="showDiffOnly"> 僅顯示有差異項目</label></div>
            </div>
            <div class="table-container">
                <table id="reportTable">
                    <thead>
                        <tr><th class="col-id">ID</th><th class="col-desc">描述</th><th class="col-val">強化前</th><th class="col-val">強化後</th><th class="col-status">狀態</th></tr>
                    </thead>
                    <tbody id="tableBody"></tbody>
                </table>
            </div>
        </div>
    </div>
    <script>
        window.OFFLINE_DATA = ${JSON.stringify(dataToSave)};
        ${scriptContent}
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
});