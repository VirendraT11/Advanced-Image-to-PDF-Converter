const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors({
    origin: 'http://127.0.0.1:5500',
}));
app.use(express.json());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.post('/upload', upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }
        const pdfDoc = await PDFDocument.create();
        const processedImages = [];

        for (const file of req.files) {
            const imagePath = file.path;
            const outputPath = path.join('uploads', `processed-${file.filename}`);

            // Convert image to JPEG for consistent processing
            await sharp(imagePath)
                .resize(800, 1000, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 80 })
                .toFile(outputPath);

            const imageBytes = await fs.promises.readFile(outputPath);
            const img = await pdfDoc.embedJpg(imageBytes);  // Embed JPEG instead of PNG
            const page = pdfDoc.addPage([img.width, img.height]);
            page.drawImage(img, {
                x: 0,
                y: 0,
                width: img.width,
                height: img.height
            });
            processedImages.push(imagePath, outputPath);
        }

        const pdfBytes = await pdfDoc.save();
        const pdfPath = path.resolve('uploads', `output-${Date.now()}.pdf`);
        await fs.promises.writeFile(pdfPath, pdfBytes);

        // Cleanup uploaded images after processing
        for (const imagePath of processedImages) {
            try {
                await fs.promises.unlink(imagePath);  // Corrected to fs.promises.unlink
            } catch (err) {
                console.error('Error deleting file:', err);
            }
        }

        res.on('close', () => {
            console.log('Request aborted by the client.');
        });

        res.download(pdfPath, 'converted.pdf', async (err) => {
            if (err) {
                if (err.code === 'ECONNABORTED') {
                    console.error('Client aborted the request.');
                } else {
                    console.error('Error sending file:', err);
                }
            }

            try {
                await fs.promises.unlink(pdfPath);  // Corrected to fs.promises.unlink
            } catch (unlinkErr) {
                console.error('Error deleting file:', unlinkErr);
            }
        });

    } catch (error) {
        console.error('Error processing images:', error);
        res.status(500).json({ error: 'Error processing images' });
    }
});

app.post('/optimize', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }
        const imagePath = req.file.path;
        const outputPath = path.join('uploads', `optimized-${req.file.filename}`);

        await sharp(imagePath)
            .resize(800, null, { withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true })
            .toFile(outputPath);

        res.on('close', () => {
            console.log('Request aborted by the client.');
        });

        res.download(outputPath, 'optimized.jpg', async (err) => {
            if (err) {
                if (err.code === 'ECONNABORTED') {
                    console.error('Client aborted the request.');
                } else {
                    console.error('Error sending file:', err);
                }
            }

            try {
                await fs.promises.unlink(imagePath);  // Corrected to fs.promises.unlink
            } catch (unlinkErr) {
                console.error('Error deleting file:', unlinkErr);
            }

            try {
                await fs.promises.unlink(outputPath);  // Corrected to fs.promises.unlink
            } catch (unlinkErr) {
                console.error('Error deleting file:', unlinkErr);
            }
        });

    } catch (error) {
        console.error('Error optimizing image:', error);
        res.status(500).json({ error: 'Error optimizing image' });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
