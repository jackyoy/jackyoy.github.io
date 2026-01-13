document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dashboard = document.getElementById('dashboard');
    const searchInput = document.getElementById('searchInput');
    const showDiffOnly = document.getElementById('showDiffOnly');
    
    // 全域變數儲存資料
    let reportData = [];

    // --- 檔案上傳處理 ---
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

    function processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                parseReport(json);
                dashboard.classList.remove('hidden');
                dropZone.style.display = 'none'; // 隱藏上傳區
            } catch (err) {
                alert("JSON 解析失敗，請確認檔案格式正確。\n" + err.message);
            }
        };
        reader.readAsText(file);
    }

    // --- 資料解析邏輯 ---
    function parseReport(json) {
        // 1. 填寫 Meta 資訊
        if (json.meta) {
            document.getElementById('metaHostname').textContent = json.meta.hostname || 'Unknown';
            // 簡單格式化時間
            const scanTime = json.meta.scan_time_final 
                ? new Date(json.meta.scan_time_final).toLocaleString() 
                : 'Unknown';
            document.getElementById('metaTime').textContent = scanTime;
        }

        // 2. 轉換 results 物件為陣列
        reportData = [];
        if (json.results) {
            Object.keys(json.results).forEach(key => {
                const item = json.results[key];
                // 移除 .yml 副檔名以取得 ID
                const id = key.replace('.yml', '');
                
                // 判斷是否有差異 (Before != After)
                const hasDiff = String(item.before).trim() !== String(item.after).trim();

                reportData.push({
                    id: id,
                    description: item.description,
                    before: item.before,
                    after: item.after,
                    expected: item.expected,
                    status: item.status, // OK, FIXED, FAILED
                    hasDiff: hasDiff
                });
            });
        }

        // 3. 計算統計
        const total = reportData.length;
        const fixedCount = reportData.filter(d => d.status === 'FIXED').length;
        
        document.getElementById('metaTotal').textContent = total;
        document.getElementById('metaFixed').textContent = fixedCount;

        // 4. 初始渲染表格
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

            // 狀態樣式
            let badgeClass = 'badge-ok';
            if (item.status === 'FIXED') badgeClass = 'badge-fixed';
            if (item.status === 'FAILED') badgeClass = 'badge-failed';

            // 差異呈現
            // 若有差異，我們使用特別的 HTML 來顯示 Before (紅) -> After (綠)
            // 若無差異，則顯示單一數值或普通的 Before/After
            let beforeHtml = escapeHtml(item.before);
            let afterHtml = escapeHtml(item.after);
            let beforeClass = "diff-cell";
            let afterClass = "diff-cell";

            if (item.hasDiff) {
                beforeClass += " diff-highlight";
                afterClass += " diff-highlight";
                beforeHtml = `<span class="val-old">${beforeHtml}</span>`;
                afterHtml = `<span class="val-new">${afterHtml}</span>`;
            } else {
                // 如果內容太長，可以考慮截斷，這裡先保留原樣
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
            // 1. 搜尋關鍵字
            const matchSearch = item.id.toLowerCase().includes(term) || 
                                item.description.toLowerCase().includes(term);
            
            // 2. 差異過濾
            const matchDiff = onlyDiff ? item.hasDiff : true;

            return matchSearch && matchDiff;
        });

        renderTable(filtered);
    }

    searchInput.addEventListener('input', filterData);
    showDiffOnly.addEventListener('change', filterData);

    // --- 工具函式 ---
    function escapeHtml(text) {
        if (text === null || text === undefined) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});