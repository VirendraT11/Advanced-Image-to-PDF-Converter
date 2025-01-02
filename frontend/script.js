document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        dropZone : document.getElementById('drop-zone'),
        fileInput : document.getElementById('file-input'),
        selectFiles : document.getElementById('select-files'),
        previewContainer : document.getElementById('preview-container'),
        imagePreview : document.getElementById('image-preview'),
        imageCount : document.getElementById('image-count'),
        convertBtn : document.getElementById('convert-btn'),
        optimizeBtn : document.getElementById('optimize-Btn'),
        clearBtn : document.getElementById('clear-btn'),
        progressContainer : document.getElementById('progress-container'),
        progress : document.getElementById('progress'),
        progressText : document.getElementById('progress-text'),
        optimizeImages : document.getElementById('optimize-images'),
        autoArrange : document.getElementById('auto-arrange')
    };
    

    let selectedFiles = [];
    
    if (elements.dropZone) {
        elements.dropZone.addEventListener('dragover', handleDragOver);
        elements.dropZone.addEventListener('dragleave', handleDragLeave);
        elements.dropZone.addEventListener('drop', handleDrop);
    }
    if (elements.selectFiles && elements.fileInput) {
        elements.selectFiles.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', handleFileSelect);
    }
    if (elements.convertBtn) {
        elements.convertBtn.addEventListener('click', handleConversion);
    }
    if (elements.optimizeBtn) {
        elements.optimizeBtn.addEventListener('click', handleOptimization);
    }
    if (elements.clearBtn) {
        elements.clearBtn.addEventListener('click', clearSelection);
    }
    if (elements.autoArrange) {
        elements.autoArrange.addEventListener('change', arrangeImages);
    }

    function handleDragOver(e) {
        e.preventDefault();
        elements.dropZone.classList.add('dragover');
    }
    function handleDragLeave(e){
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
    }
    function handleDrop(e){
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        handleFiles(files);
    }
    function handleFileSelect(e){
        const files = Array.from(e.target.files);
        handleFiles(files);
    }

    function handleFiles(files){
        if(files.length === 0) return;
        
        files.forEach(file => {
            if(!selectedFiles.some(f => f.name === file.name)){
                if(file.size > 5*1024*1024){
                    showToast('File size should not exceed 5MB', 'error');
                    return;
                }
                selectedFiles.push(file);
                createImagePreview(file);
            }
        });
        updateUI(); 
    }
    function createImagePreview(file){
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'image-item';

            const img = document.createElement('img');
            img.src = e.target.result;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            removeBtn.onclick = () => removeImage(file.name, div);

            div.appendChild(img);
            div.appendChild(removeBtn);
            elements.imagePreview.appendChild(div);
        };
        reader.readAsDataURL(file);
    }
    function removeImage(fileName, element){
        selectedFiles = selectedFiles.filter(file => file.name !== fileName);
        element.remove();
        updateUI();
    }
    function updateUI(){
        const hasFiles = selectedFiles.length > 0;
        elements.previewContainer.classList.toggle('hidden', !hasFiles);
        elements.convertBtn.disabled = !hasFiles;
        elements.optimizeBtn.disabled = !hasFiles;
        elements.clearBtn.disabled = !hasFiles;
        elements.imageCount.textContent = `(${selectedFiles.length})`;
    }

    async function handleConversion() {
        if (selectedFiles.length === 0) return;
        try {
            showProgress();
            const formData = new FormData();
            selectedFiles.forEach(file => formData.append('images', file));

            if (elements.optimizeImages.checked) {
                updateProgress(20, 'Optimizing images...');
                await optimizeImagesBeforeConversion(formData);
            }

            updateProgress(50, 'Converting to PDF...');
            const response = await fetch('http://localhost:3000/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

            const blob = await response.blob();
            downloadFile(blob, 'converted.pdf');
            showToast('Conversion successful', 'success');
        } catch (error) {
            console.error('Error:', error);
            showToast('Error during conversion: ' + error.message, 'error');
        } finally {
            hideProgress();
        }
    }
    async function handleOptimization() {
        if (selectedFiles.length === 0) return;
        try {
            showProgress();
            const optimizedFiles = [];

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const progress = Math.round(((i + 1) / selectedFiles.length) * 100);
                updateProgress(progress, `Optimizing image ${i + 1} of ${selectedFiles.length}...`);

                const formData = new FormData();
                formData.append('image', file);

                const response = await fetch('http://localhost:3000/optimize', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error('Optimization failed');

                const blob = await response.blob();
                const optimizedFile = new File([blob], `optimized-${file.name}`, { type: 'image/jpeg' });
                optimizedFiles.push(optimizedFile);
            }

            const zip = new JSZip();
            optimizedFiles.forEach(file => zip.file(file.name, file));
            const content = await zip.generateAsync({ type: 'blob' });
            downloadFile(content, 'optimized-images.zip');
            showToast('Optimization completed successfully!', 'success');
        } catch (error) {
            console.error('Error:', error);
            showToast('Error during optimization', 'error');
        } finally {
            hideProgress();
        }
    }
    async function optimizeImagesBeforeConversion(formData) {
        const optimizedFiles = [];
        for (const [key, value] of formData.entries()) {
            if (key === 'images') {
                const file = value;
                const formDataForOptimization = new FormData();
                formDataForOptimization.append('image', file);

                const response = await fetch('http://localhost:3000/optimize', {
                    method: 'POST',
                    body: formDataForOptimization,
                });

                if (!response.ok) throw new Error('Image optimization failed');

                const optimizedBlob = await response.blob();
                const optimizedFile = new File([optimizedBlob], file.name, { type: file.type });
                optimizedFiles.push(optimizedFile);
            }
        }
        return optimizedFiles;
    }
    
    function showProgress(){
        elements.progressContainer.classList.remove('hidden');
        elements.convertBtn.disabled = true;
        elements.optimizeBtn.disabled = true;
    }
    function hideProgress(){
        elements.progressContainer.classList.add('hidden');
        updateUI();
    }
    function updateProgress(value, text){
        elements.progress.style.width = `${value}%`;
        elements.progressText.textContent = text;
    }
    function showToast(message, type = 'success'){
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    function downloadFile(blob, fileName){
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    }
    function clearSelection(){
        selectedFiles = [];
        elements.imagePreview.innerHTML = '';
        updateUI();
    }
    function arrangeImages() {
        if(!elements.autoArrange.checked || selectedFiles.length === 0) return;

        const imageItems = Array.from(elements.imagePreview.children);  
        imageItems.sort((a, b) => {
            const aRect  = a.querySelector('img').getBoundingClientRect();
            const bRect  = b.querySelector('img').getBoundingClientRect();
            return (aRect.width / aRect.height) - (bRect.width / bRect.height);
        });
        imageItems.forEach(item => elements.imagePreview.appendChild(item));
    }
    
});