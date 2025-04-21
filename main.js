const express = require('express');
const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec } = require('child_process');

const app = express();

// Serve static files (like CSS) from the current directory
app.use(express.static(path.join(__dirname)));

// Serve the usage guide on the `/` route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/time', (req, res) => {
    const { font = 'Arial', fontURL, tz = 'UTC', fontSize = '40', color = 'black', bgColor = 'transparent' } = req.query;

    let fontFamily = font;
    const fontSizePx = parseInt(fontSize, 10);

    // Handle custom font download and conversion
    if (fontURL) {
        const fontPath = path.resolve('./fonts/custom_font.woff2');
        const convertedFontPath = path.resolve('./fonts/custom_font.ttf');

        // Download the font
        if (!fs.existsSync(fontPath)) {
            console.log('Downloading custom font...');
            downloadFont(fontURL, fontPath, () => {
                console.log('Converting font to TTF...');
                // Convert the font to TTF using a tool like fonttools
                exec(`pyftsubset ${fontPath} --output-file=${convertedFontPath} --flavor=truetype`, (err, stdout, stderr) => {
                    if (err) {
                        console.error(`Error converting font: ${stderr}`);
                        fontFamily = 'Arial'; // Fallback to Arial
                    } else {
                        console.log('Font converted successfully.');
                        try {
                            registerFont(convertedFontPath, { family: 'CustomFont' });
                            fontFamily = 'CustomFont';
                        } catch (err) {
                            console.error(`Failed to register custom font: ${err.message}`);
                            fontFamily = 'Arial'; // Fallback to Arial
                        }
                    }
                });
            });
        } else {
            try {
                registerFont(convertedFontPath, { family: 'CustomFont' });
                fontFamily = 'CustomFont';
            } catch (err) {
                console.error(`Failed to register custom font: ${err.message}`);
                fontFamily = 'Arial'; // Fallback to Arial
            }
        }
    } else if (font === 'Pixel') {
        // Handle the Pixel font
        const fontPath = path.resolve('./fonts/ms_sans_serif.woff2');
        if (!fs.existsSync(fontPath)) {
            console.log('Downloading Pixel font...');
            downloadFont('https://unpkg.com/98.css@0.1.20/dist/ms_sans_serif.woff2', fontPath, () => {
                registerFont(fontPath, { family: 'Pixel' });
            });
        } else {
            registerFont(fontPath, { family: 'Pixel' });
        }
        fontFamily = 'Pixel';
    } else {
        // Register the font if provided
        try {
            registerFont(`./fonts/${font}.ttf`, { family: font });
        } catch (err) {
            console.error(`Font not found: ${font}, falling back to Arial.`);
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
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});