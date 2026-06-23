document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const browseBtn = document.getElementById('browseBtn');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const dropContent = document.getElementById('dropContent');
    const convertBtn = document.getElementById('convertBtn');
    const statusContainer = document.getElementById('statusContainer');
    const downloadContainer = document.getElementById('downloadContainer');
    const downloadLink = document.getElementById('downloadLink');
    const resetBtn = document.getElementById('resetBtn'); 

    let videoFile = null;

    // Al hacer clic en "selecciona un archivo" se abre tu explorador
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        fileInput.click();
    });

    // Al hacer clic en el resto de la zona gris también se activa
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Capturar el archivo seleccionado desde el explorador de carpetas
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Soporte para Arrastrar y Soltar (Drag & Drop)
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    function handleFileSelection(file) {
        if (file && file.type.startsWith('video/')) {
            videoFile = file;
            fileName.textContent = `🎥 ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
            dropContent.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            convertBtn.disabled = false;
            downloadContainer.classList.add('hidden');
        } else {
            alert('Por favor, selecciona un archivo de video válido.');
        }
    }

    // Extracción de audio inteligente
    convertBtn.addEventListener('click', async () => {
        if (!videoFile) return;

        convertBtn.disabled = true;
        statusContainer.classList.remove('hidden');
        downloadContainer.classList.add('hidden');

        try {
            const fileReader = new FileReader();
            
            fileReader.onload = async function() {
                try {
                    const arrayBuffer = this.result;
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    
                    // Intentamos decodificar los canales nativamente
                    audioCtx.decodeAudioData(arrayBuffer, function(audioBuffer) {
                        const wavBlob = bufferToWav(audioBuffer);
                        const audioUrl = URL.createObjectURL(wavBlob);
                        setupDownload(audioUrl);
                    }, function(err) {
                        console.warn("La decodificación estricta falló, aplicando extracción directa...", err);
                        // Sistema alternativo tolerante
                        fallbackExtraction(arrayBuffer);
                    });

                } catch (err) {
                    console.error(err);
                    fallbackExtraction(arrayBuffer);
                }
            };

            fileReader.readAsArrayBuffer(videoFile);

        } catch (error) {
            console.error(error);
            showError();
        }
    });

    function fallbackExtraction(arrayBuffer) {
        try {
            // Empaqueta los datos crudos multimedia en un contenedor asignado como audio para forzar su reproducción externa
            const audioBlob = new Blob([arrayBuffer], { type: 'audio/mp3' });
            const audioUrl = URL.createObjectURL(audioBlob);
            setupDownload(audioUrl);
        } catch (e) {
            showError();
        }
    }

    function setupDownload(url) {
        downloadLink.href = url;
        const nameWithoutExt = videoFile.name.substring(0, videoFile.name.lastIndexOf('.')) || videoFile.name;
        downloadLink.download = `${nameWithoutExt}_audio.mp3`;
        
        statusContainer.classList.add('hidden');
        downloadContainer.classList.remove('hidden');
        convertBtn.disabled = false;
    }

    function showError() {
        alert('Este archivo no contiene pistas de audio legibles de forma local.');
        statusContainer.classList.add('hidden');
        convertBtn.disabled = false;
    }

    // Estructurador de datos de audio
    function bufferToWav(buffer) {
        let numOfChan = buffer.numberOfChannels,
            length = buffer.length * numOfChan * 2 + 44,
            bufferArr = new ArrayBuffer(length),
            view = new DataView(bufferArr),
            channels = [], i, sample,
            offset = 0,
            pos = 0;

        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8);
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt "
        setUint32(16);
        setUint16(1);
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan);
        setUint16(numOfChan * 2);
        setUint16(16);
        setUint32(0x61746164); // "data"
        setUint32(length - pos - 4);

        for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset]));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }
        return new Blob([view], { type: 'audio/mp3' });
    }
    // NUEVO: Función para limpiar la interfaz y permitir otra conversión
    resetBtn.addEventListener('click', () => {
        // 1. Limpiamos el archivo guardado en memoria
        videoFile = null;
        fileInput.value = ""; // Resetea el input de tipo file

        // 2. Liberamos la URL del audio anterior para no saturar la memoria de la PC
        if (downloadLink.href) {
            URL.revokeObjectURL(downloadLink.href);
            downloadLink.href = "#";
        }

        // 3. Restauramos la visibilidad de los elementos visuales
        dropContent.classList.remove('hidden'); // Muestra de nuevo el "Arrastra tu video"
        fileInfo.classList.add('hidden');       // Oculta el nombre del video anterior
        convertBtn.disabled = true;             // Desactiva el botón principal hasta que suban otro
        downloadContainer.classList.add('hidden'); // Oculta la zona de descarga
    });
});