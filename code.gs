// Replace with your Telegram bot token
const TELEGRAM_BOT_TOKEN = 'TELEGRAM_BOT_TOKEN';

// Replace with your Google Sheet ID
const SHEET_ID = "SHEET_ID"

// Replace with your Google Translate API key
const GOOGLE_TRANSLATE_API_KEY = "GOOGLE_TRANSLATE_API_KEY";

const TELEGRAM_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

function doPost(e) {
    if (!e || !e.postData || !e.postData.contents) {
        Logger.log("Invalid request: No postData found");
        return;
    }

    let contents = JSON.parse(e.postData.contents);
    let message = contents.message;
    if (!message) {
        Logger.log("No message found in the contents");
        return;
    }

    let chatId = message.chat.id;
    let text = message.text || "";
    let commandArr = text.split(" ")[0].split("@");
    let word = text.split(" ").slice(1).join(" "); // Capture all the text after the command

    if (commandArr[0] === '/translate') {
        handleTranslationAndDefinition(chatId, word);
    } else if (commandArr[0] === '/start') {
        sendText(chatId, "👋 Welcome! Use /translate followed by a word or phrase to translate it and get its definitions and phonetics.");
    } else {
        sendText(chatId, "Command not recognized. Use /translate followed by a word or phrase.");
    }
}

function handleTranslationAndDefinition(chatId, word) {
    if (!word) {
        sendText(chatId, "Please provide a word after the command /translate. Example: /translate Hello");
        return;
    }

    translateText(word, 'en', 'uk').then(translatedText => {
        fetchDefinitions(word).then(definitions => {
            fetchPhonetics(word).then(phonetics => {
                sendText(chatId, `Translated Text: ${translatedText}\n\nDefinitions:\n${definitions}\n\nPhonetics:\n${phonetics}`);
                writeToSheet(word, translatedText, definitions, phonetics);
            });
        });
    });
}

async function translateText(word, sourceLang, targetLang) {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}&q=${encodeURIComponent(word)}&source=${sourceLang}&target=${targetLang}`;
    try {
        let response = await UrlFetchApp.fetch(url);
        let data = JSON.parse(response.getContentText());
        if (data && data.data && data.data.translations) {
            return data.data.translations[0].translatedText;
        }
        return "Translation failed.";
    } catch (error) {
        return `Error in translation: ${error}`;
    }
}

async function fetchDefinitions(word) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    try {
        let response = await UrlFetchApp.fetch(url);
        let data = JSON.parse(response.getContentText());

        if (data && !data.title) {
            let definitionsText = data.flatMap(entry => 
                entry.meanings.map(meaning => 
                    meaning.definitions.map(def => 
                        `(${meaning.partOfSpeech}) ${def.definition}`
                    ).join('; ')
                )
            ).join('\n');
            return definitionsText;
        }
        return "No definitions found.";
    } catch (error) {
        return `Error fetching definitions: ${error}`;
    }
}

async function fetchPhonetics(word) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    try {
        let response = await UrlFetchApp.fetch(url);
        let data = JSON.parse(response.getContentText());

        if (data && !data.title && data.length > 0) {
            let phoneticSet = new Set();  // Use a Set to store unique phonetic texts
            data.forEach(entry => {
                entry.phonetics.forEach(ph => {
                    if (ph.text) {
                        phoneticSet.add(ph.text);  // Add only unique phonetic texts
                    }
                });
            });
            let phoneticsText = Array.from(phoneticSet).join(', ');  // Convert Set back to array for joining into string
            return phoneticsText || "No phonetics available.";
        }
        return "No phonetics found.";
    } catch (error) {
        return `Error fetching phonetics: ${error}`;
    }
}


function sendText(chatId, text) {
    let url = `${TELEGRAM_URL}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`;
    UrlFetchApp.fetch(url);
}

function writeToSheet(word, translatedText, definitions, phonetics) {
    try {
        const ss = SpreadsheetApp.openById(SHEET_ID);
        const sheet = ss.getSheetByName("Data") || ss.insertSheet("Data");
        if (sheet.getLastRow() === 0) {  // Check if the sheet is empty and add headers
            sheet.appendRow(["Date", "Word", "Meaning", "Definition", "Phonetics"]);
        }
        sheet.appendRow([new Date(), word, translatedText, definitions, phonetics]);
        Logger.log("Data written to sheet: Word - " + word + ", Meaning - " + translatedText + ", Definition - " + definitions + ", Phonetics - " + phonetics);
    } catch (error) {
        Logger.log(`Error writing to sheet: ${error}`);
    }
}

