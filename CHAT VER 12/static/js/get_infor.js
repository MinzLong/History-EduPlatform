async function getCharacterInfo() {
    const characterName = document.getElementById('customCharacterInput').value;
    const response = await fetch('/get_character_info', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ character_name: characterName }),
    });

    if (response.ok) {
        const data = await response.json();
        console.log(data);  // Log the response data to debug

        const characterInfo = data.character_info;
        const relatedLinks = data.related_links;

        // Display character information
        const infoHtml = `
            <h3>${characterInfo.displaytitle}</h3>
            <p><strong>Description:</strong> ${characterInfo.description}</p>
            <p><strong>Extract:</strong> ${characterInfo.extract}</p>
            <img src="${characterInfo.originalimage ? characterInfo.originalimage.source : ''}">
            <h3>Related Links:</h3>
        `;
        document.getElementById('characterInfo').innerHTML = infoHtml;

        // Display related links
        document.getElementById('relatedLinks').innerHTML = relatedLinks.map(link => `<li><a href="${link}" target="_blank">${link}</a></li>`).join('');
    } else {    
        document.getElementById('characterInfo').textContent = 'Loading.....';
        document.getElementById('relatedLinks').innerHTML = '';
    }
}
