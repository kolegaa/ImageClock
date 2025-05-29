const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');

// Helper function to download the font if it doesn't exist
const downloadFont = (url, outputPath, callback) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
            file.close(() => {
                console.log(`Font downloaded successfully to ${outputPath}`);
                callback();
            });
        });
    }).on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file if an error occurs
        console.error(`Error downloading font: ${err.message}`);
    });
};

// Helper function to register the default font
const registerDefaultFont = () => {
    try {
        const defaultFontPath = path.resolve(__dirname, 'fonts', 'Pixel.ttf'); // Adjust path if necessary
        if (fs.existsSync(defaultFontPath)) {
            registerFont(defaultFontPath, { family: 'Pixel' });
            console.log('Default font (Pixel) registered successfully.');
        } else {
            console.error('Default font file (Pixel.ttf) is missing.');
        }
    } catch (err) {
        console.error(`Failed to register default font: ${err.message}`);
    }
};

// Register the default font at startup
registerDefaultFont();

module.exports = async (req, res) => {
    const { font = 'Pixel', fontURL, tz = 'UTC', fontSize = '40', color = 'black', bgColor = 'transparent' } = req.query;

    let fontFamily = font;
    const fontSizePx = parseInt(fontSize, 10);

    const fontPath = path.resolve('/tmp/custom_font.woff2');
    const convertedFontPath = path.resolve('/tmp/custom_font.ttf');

    // Handle custom font download and conversion
    if (fontURL) {
        if (!fs.existsSync(fontPath)) {
            console.log('Downloading custom font...');
            await new Promise((resolve, reject) => {
                downloadFont(fontURL, fontPath, async () => {
                    console.log('Converting font to TTF...');
                    exec(`pyftsubset ${fontPath} --output-file=${convertedFontPath} --flavor=truetype`, (err, stdout, stderr) => {
                        if (err) {
                            console.error(`Error converting font: ${stderr}`);
                            fontFamily = 'Pixel'; // Fallback to Pixel
                            reject(err);
                        } else {
                            console.log('Font converted successfully.');
                            if (fs.existsSync(convertedFontPath)) {
                                try {
                                    registerFont(convertedFontPath, { family: 'CustomFont' });
                                    fontFamily = 'CustomFont';
                                    console.log('Custom font registered successfully.');
                                    resolve();
                                } catch (err) {
                                    console.error(`Failed to register custom font: ${err.message}`);
                                    fontFamily = 'Pixel'; // Fallback to Pixel
                                    reject(err);
                                }
                            } else {
                                console.error('Converted font file does not exist.');
                                fontFamily = 'Pixel'; // Fallback to Pixel
                                reject(new Error('Converted font file missing.'));
                            }
                        }
                    });
                });
            }).catch((err) => {
                console.error(`Font processing failed: ${err.message}`);
            });
        } else {
            console.log('Font already exists, skipping download.');
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