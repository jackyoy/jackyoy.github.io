document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const outputArea = document.getElementById('output-area');

    fileInput.addEventListener('change', handleFiles);

    async function handleFiles(event) {
        const files = Array.from(event.target.files);
        outputArea.innerHTML = ''; // 清空區域

        if (files.length === 0) return;

        if (files.length === 1) {
            // 單一檔案模式：顯示語法高亮
            const content = await readFile(files[0]);
            renderSingleFile(files[0].name, content);
        } else if (files.length === 2) {
            // 雙檔案模式：顯示左右比對
            const [file1, file2] = files;
            const content1 = await readFile(file1);
            const content2 = await readFile(file2);
            renderDiffView(file1.name, content1, file2.name, content2);
        } else {
            alert('請勿上傳超過兩個檔案。');
            fileInput.value = ''; // 重置
        }
    }

    // Promise 封裝 FileReader
    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // 渲染單一檔案
    function renderSingleFile(filename, content) {
        const wrapper = document.createElement('div');
        
        // 防 XSS 處理
        const safeContent = content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        wrapper.innerHTML = `
            <h3 style="color: #61afef; margin-bottom: 10px;">📄 ${filename}</h3>
            <pre><code class="language-bash">${safeContent}</code></pre>
        `;
        
        outputArea.appendChild(wrapper);
        
        // 觸發 Highlight.js
        hljs.highlightElement(wrapper.querySelector('code'));
    }

    // 渲染比對視圖 (Side-by-Side)
    function renderDiffView(name1, content1, name2, content2) {
        // 使用 jsdiff 建立 Unified Diff Patch string
        // createTwoFilesPatch(oldFileName, newFileName, oldStr, newStr)
        const diffString = Diff.createTwoFilesPatch(name1, name2, content1, content2);

        const targetElement = document.createElement('div');
        targetElement.id = 'diff-target';
        outputArea.appendChild(targetElement);

        const configuration = {
            drawFileList: false,
            matching: 'lines',
            outputFormat: 'side-by-side', // 左右對照模式
            renderNothingWhenEmpty: false,
        };

        const diff2htmlUi = new Diff2HtmlUI(targetElement, diffString, configuration);
        diff2htmlUi.draw();
        diff2htmlUi.highlightCode(); // 啟用 Diff 內部的語法高亮
    }
});