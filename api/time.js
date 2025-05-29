const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');

// Helper function to download the font if it doesn't exist
const downloadFont = (url, outputPath) => {
    return new Promise((resolve, reject) => {
        // Validate URL
        try {
            new URL(url);
        } catch (e) {
            reject(new Error('Invalid font URL'));
            return;
        }

        const file = fs.createWriteStream(outputPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download font: ${response.statusCode}`));
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve());
            });
        }).on('error', (err) => {
            fs.unlink(outputPath, () => {});
            reject(err);
        });
    });
};

module.exports = async (req, res) => {
    const { font = 'Pixel', fontURL, tz = 'UTC', fontSize = '40', color = 'black', bgColor = 'transparent' } = req.query;

    let fontFamily = font;
    const fontSizePx = parseInt(fontSize, 10);

    // Use URL-safe filename based on the fontURL
    const fontFileName = fontURL ? Buffer.from(fontURL).toString('base64').replace(/[/+=]/g, '_') : '';
    const fontPath = path.resolve(`/tmp/${fontFileName}.font`);
    const convertedFontPath = path.resolve(`/tmp/${fontFileName}.ttf`);

    // Handle custom font download and conversion
    if (fontURL) {
        try {
            if (!fs.existsSync(convertedFontPath)) {
                await downloadFont(fontURL, fontPath);
                await new Promise((resolve, reject) => {
                    exec(`pyftsubset ${fontPath} --output-file=${convertedFontPath} --flavor=truetype`, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            registerFont(convertedFontPath, { family: 'CustomFont' });
            fontFamily = 'CustomFont';
        } catch (err) {
            console.error(`Font processing error: ${err.message}`);
            fontFamily = 'Pixel'; // Fallback to Pixel
        }
    } else {
        // Default to Pixel font
        try {
            const pixelFontPath = path.resolve('./fonts/ms_sans_serif.ttf'); // Use the converted TTF file
            if (fs.existsSync(pixelFontPath)) {
                registerFont(pixelFontPath, { family: 'Pixel' });
                fontFamily = 'Pixel';
            } else {
                console.error('Pixel font not found, falling back to Arial.');
                fontFamily = 'Arial';
            }
        } catch (err) {
            console.error(`Failed to register Pixel font: ${err.message}`);
            fontFamily = 'Arial'; // Fallback to Arial
        }
    }

    // Get the current time in 24-hour format
    let currentTime;
    try {
        currentTime = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    } catch (err) {
        console.error(`Invalid time zone: ${tz}, falling back to UTC.`);
        currentTime = new Date().toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
    }

    // Create a temporary canvas to measure text dimensions
    const tempCanvas = createCanvas(1, 1);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = `${fontSizePx}px ${fontFamily}`;
    const textWidth = tempCtx.measureText(currentTime).width;
    const textHeight = fontSizePx * 1.2; // Approximation for text height

    // Create a canvas with dynamic size
    const canvas = createCanvas(textWidth + 2, textHeight + 2); // Add padding
    const ctx = canvas.getContext('2d');

    // Set background color
    if (bgColor !== 'transparent') {
        ctx.fillStyle = bgColor; // Use the provided background color
        ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill the background
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Transparent background
    }

    // Draw the text
    ctx.fillStyle = color; // Use the provided text color
    ctx.font = `${fontSizePx}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentTime, canvas.width / 2, canvas.height / 2);

    // Send the PNG as a response
    res.setHeader('Content-Type', 'image/png');
    canvas.createPNGStream().pipe(res);
};