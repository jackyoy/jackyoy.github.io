document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const actionBtn = document.getElementById('actionBtn');
    const statusDiv = document.getElementById('status');
    const fileNameDiv = document.getElementById('fileName');
    let selectedFile = null;
    let downloadUrl = null;

    // 監聽檔案上傳
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            fileNameDiv.textContent = selectedFile.name;
            fileNameDiv.style.color = "#2d3748";
            actionBtn.disabled = false;
            actionBtn.textContent = "開始轉換";
            actionBtn.className = ""; 
            if (downloadUrl) {
                URL.revokeObjectURL(downloadUrl);
                downloadUrl = null;
            }
            statusDiv.textContent = "";
        }
    });

    // 監聽按鈕點擊
    actionBtn.addEventListener('click', () => {
        if (actionBtn.classList.contains('download')) {
            const a = document.createElement('a');
            a.href = downloadUrl;
            let newName = selectedFile.name.replace(/\.(txt|html|htm)$/i, '') + '_report.html';
            a.download = newName;
            a.click();
        } else {
            processFile();
        }
    });

    // 主處理流程
    function processFile() {
        actionBtn.disabled = true;
        actionBtn.textContent = "處理中...";
        statusDiv.textContent = "正在讀取檔案...";

        const reader = new FileReader();
        reader.onload = function(e) {
            let textContent = e.target.result;
            
            try {
                // 如果是 HTML 檔，先過濾標籤，還原成純文字
                if (selectedFile.name.toLowerCase().endsWith('.html') || selectedFile.name.toLowerCase().endsWith('.htm')) {
                    statusDiv.textContent = "偵測到 HTML 格式，正在還原純文字...";
                    textContent = extractTextFromHtml(textContent);
                }

                const sections = parseLog(textContent);
                
                if (sections.length === 0) {
                    throw new Error("無法識別結構，請確認檔案內容包含 '[ SECTION ]' 分隔線。");
                }

                const reportHtml = generateReportHtml(selectedFile.name, sections);

                const blob = new Blob([reportHtml], { type: 'text/html' });
                downloadUrl = URL.createObjectURL(blob);

                actionBtn.textContent = "下載 HTML 報告";
                actionBtn.classList.add('download');
                actionBtn.disabled = false;
                statusDiv.textContent = `解析成功！共發現 ${sections.length} 個區塊。`;

            } catch (err) {
                console.error(err);
                statusDiv.textContent = "錯誤: " + err.message;
                statusDiv.style.color = "#e53e3e";
                actionBtn.textContent = "重試";
                actionBtn.disabled = false;
            }
        };
        reader.readAsText(selectedFile);
    }

    // 工具：從 HTML 提取文字
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

    // 工具：解析 Log 結構
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
                if (content) {
                    if (sections.length > 0) {
                        sections[sections.length - 1].content = content;
                    } else {
                        sections.push({ title: "File Header / Meta", content: content, id: "header" });
                    }
                }
            }
            const safeId = "sec-" + Math.random().toString(36).substr(2, 9);
            sections.push({ title: title, content: "", id: safeId });
            lastIndex = endIndex;
        }

        if (lastIndex < text.length) {
            const content = text.substring(lastIndex).trim();
            if (sections.length > 0) {
                sections[sections.length - 1].content = content;
            }
        }
        return sections;
    }

    // 工具：生成最終報告 HTML
    function generateReportHtml(filename, sections) {
        const dateStr = new Date().toLocaleString();
        
        const navHtml = sections.map(sec => 
            `<a href="#${sec.id}" class="nav-link">${sec.title}</a>`
        ).join('');

        const contentHtml = sections.map(sec => `
            <div id="${sec.id}" class="section-card">
                <div class="section-header">
                    <h2>${sec.title}</h2>
                    <button class="copy-btn" onclick="copyToClipboard('${sec.id}')">複製內容</button>
                </div>
                <div class="section-body">
                    <pre id="pre-${sec.id}">${escapeHtml(sec.content)}</pre>
                </div>
            </div>
        `).join('');

        // 關鍵修正：在字串中寫 script 標籤時，結束標籤的斜線必須轉義 "<\/script>"
        // 否則瀏覽器解析器會誤以為外部的 script 結束了。
        return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>報告: ${filename}</title>
    <style>
        :root { --sidebar-width: 280px; --primary: #2b6cb0; --bg: #f7fafc; --text: #2d3748; }
        body { margin: 0; display: flex; height: 100vh; font-family: Consolas, Monaco, "Courier New", monospace; color: var(--text); background: var(--bg); overflow: hidden; }
        aside { width: var(--sidebar-width); background: #1a202c; color: #e2e8f0; display: flex; flex-direction: column; flex-shrink: 0; }
        .nav-header { padding: 1.5rem; background: #2d3748; border-bottom: 1px solid #4a5568; }
        .nav-header h3 { margin: 0; font-size: 1rem; color: white; word-break: break-all; }
        .nav-header span { font-size: 0.75rem; color: #a0aec0; }
        .nav-list { flex: 1; overflow-y: auto; padding: 1rem 0; }
        .nav-link { display: block; padding: 0.75rem 1.5rem; color: #cbd5e0; text-decoration: none; font-size: 0.85rem; border-left: 3px solid transparent; transition: 0.2s; }
        .nav-link:hover { background: #2d3748; color: white; }
        main { flex: 1; overflow-y: auto; padding: 2rem; scroll-behavior: smooth; position: relative; }
        .section-card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 2rem; border: 1px solid #e2e8f0; overflow: hidden; }
        .section-header { background: #edf2f7; padding: 0.75rem 1.5rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; }
        .section-header h2 { margin: 0; font-size: 1.1rem; color: var(--primary); }
        .copy-btn { background: white; border: 1px solid #cbd5e0; padding: 4px 12px; font-size: 0.75rem; border-radius: 4px; cursor: pointer; }
        .copy-btn:hover { background: #ebf8ff; color: var(--primary); }
        .section-body { padding: 0; overflow-x: auto; }
        pre { margin: 0; padding: 1.5rem; font-size: 0.85rem; line-height: 1.5; color: #1a202c; }
        @media (max-width: 768px) { body { flex-direction: column; } aside { width: 100%; height: 200px; } }
    </style>
</head>
<body>
    <aside>
        <div class="nav-header">
            <h3>${filename}</h3>
            <span>生成於: ${dateStr}</span>
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
            const text = document.getElementById('pre-' + id).innerText;
            navigator.clipboard.writeText(text).then(() => {
                alert('內容已複製');
            });
        }
    <\/script>
</body>
</html>`;
    }

    // 工具：XSS 防護
    function escapeHtml(text) {
        if (!text) return "";
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }
});