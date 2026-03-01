const fs = require('fs');
const pdf = require('pdf-parse');
let dataBuffer = fs.readFileSync('.agents/skills/estilo-proyecto/recursos/Personalidad de marca.pdf');
pdf(dataBuffer).then(function (data) {
    console.log(data.text);
}).catch(function (err) {
    console.error(err);
});
