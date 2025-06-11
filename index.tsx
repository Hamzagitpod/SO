
import { GoogleGenAI } from "@google/genai";

declare var mammoth: any; // For mammoth.js library, assuming it's loaded globally

declare global {
    interface Window {
        removeFile: (index: number) => void;
    }
}

// --- Data Structures ---
interface Product {
    name: string;
    price: number;
    description: string;
    volume_kilogram?: number | null;
    volume_litre?: number | null;
    abv_percentage?: number | null;
    caffeine_mg?: number | null;
}

interface MenuCategory {
    category: string;
    products: Product[];
}

// DOM Elements
const step1 = document.getElementById('step1') as HTMLElement | null;
const step2 = document.getElementById('step2') as HTMLElement | null;
const step3 = document.getElementById('step3') as HTMLElement | null;
const loader = document.getElementById('loader') as HTMLElement | null;
const loaderSubtitle = document.getElementById('loader-subtitle') as HTMLElement | null;

const textInput = document.getElementById('text-input') as HTMLTextAreaElement | null;
const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
const dropZone = document.getElementById('drop-zone') as HTMLElement | null;
const galleryPreview = document.getElementById('gallery-preview') as HTMLElement | null;
const processBtn = document.getElementById('process-btn') as HTMLButtonElement | null;

let uploadedFiles: File[] = [];
let menuData: MenuCategory[] = [];
let tmsOutput: string = '';
let categoriesOutput: string = '';

const MAX_FILES = 7;
const MAX_FILE_SIZE_MB = 4;
const MAX_TEXT_LENGTH = 25000;

// --- Google GenAI SDK Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


// --- Drag & Drop ---
if (dropZone) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, preventDefaults, false));
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.add('border-purple-500', 'bg-purple-50'), false));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, () => dropZone.classList.remove('border-purple-500', 'bg-purple-50'), false));
    dropZone.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e: Event) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e: DragEvent) {
    if (e.dataTransfer) {
        handleFiles(e.dataTransfer.files);
    }
}

// --- File Handling ---
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) {
            handleFiles(target.files);
        }
    });
}

function handleFiles(files: FileList) {
    hideError();
    const newFilesArray = Array.from(files);

    const validNewFiles = newFilesArray.filter(file => {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            showError(`Le fichier "${escapeHtml(file.name)}" est trop volumineux (max ${MAX_FILE_SIZE_MB}MB).`);
            return false;
        }
        return true;
    });

    if (uploadedFiles.length + validNewFiles.length > MAX_FILES) {
        showError(`Vous ne pouvez télécharger que ${MAX_FILES} fichiers au maximum.`);
        return;
    }
    
    uploadedFiles.push(...validNewFiles);
    if (uploadedFiles.length > 0 && textInput) {
        textInput.value = '';
        textInput.disabled = true;
    }
    renderGallery();
}

window.removeFile = function(index: number) {
    uploadedFiles.splice(index, 1);
    renderGallery();
    if (uploadedFiles.length === 0 && textInput) {
        textInput.disabled = false;
    }
}

function renderGallery() {
    if (!galleryPreview) return;
    galleryPreview.innerHTML = '';
    uploadedFiles.forEach((file, index) => {
        const previewElement = document.createElement('div');
        previewElement.className = 'relative file-preview group';
        let previewContent = `<div class="w-full h-24 bg-gray-200 rounded-lg flex flex-col items-center justify-center text-purple-600 p-2 text-center text-xs break-all" aria-label="Aperçu du fichier ${escapeHtml(file.name)}">
                                <svg class="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                ${escapeHtml(file.name)}
                              </div>`;

        if (file.type.startsWith('image/')) {
            const objectURL = URL.createObjectURL(file);
            previewContent = `<img src="${objectURL}" class="w-full h-24 object-cover rounded-lg shadow-sm" alt="Aperçu de ${escapeHtml(file.name)}">`;
        }
        previewElement.innerHTML = `${previewContent}<button aria-label="Supprimer ${escapeHtml(file.name)}" onclick="window.removeFile(${index})" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>`;
        galleryPreview.appendChild(previewElement);
    });
}

// --- Main Process ---
if (processBtn) {
    processBtn.addEventListener('click', async () => {
        if (!textInput) return; 
        const menuContent = textInput.value.trim();
        if (!menuContent && uploadedFiles.length === 0) {
            showError("Veuillez coller du texte ou sélectionner des fichiers.");
            return;
        }

        hideError();
        if (step1) step1.classList.add('hidden');
        if (loader) loader.classList.remove('hidden');
        if (processBtn) processBtn.disabled = true;
        console.log("Process button clicked. UI: Loader shown, Step 1 hidden.");

        try {
            if (uploadedFiles.length > 0) {
                console.log(`Starting to process ${uploadedFiles.length} files.`);
                menuData = await processFiles(uploadedFiles);
            } else {
                console.log("Starting to process text input.");
                menuData = await processText(menuContent);
            }

            console.log("Data processing complete. Resulting menuData:", JSON.parse(JSON.stringify(menuData)));

            if (!menuData || menuData.length === 0) {
                console.warn("WARNING: menuData is empty or null after processing. This means the AI might not have found any structured data to extract from the input, or the data was invalid.");
            }
            
            console.log("Attempting to render Step 2 with the processed data...");
            renderStep2();
            
            if (loader) loader.classList.add('hidden');
            if (step2) step2.classList.remove('hidden');
            console.log("Step 2 rendered and shown. Loader hidden.");

        } catch (err: any) {
            console.error("CRITICAL ERROR in processBtn click handler:", err);
            console.error("Error Name:", err.name);
            console.error("Error Message:", err.message);
            console.error("Error Stack:", err.stack);
            showError(`Erreur critique durant le traitement : ${err.message}. Vérifiez la console du navigateur (F12) pour plus de détails techniques.`);
            if (loader) loader.classList.add('hidden');
            if (step1) step1.classList.remove('hidden');
            console.log("Error handled: Loader hidden, Step 1 reshown.");
        } finally {
            if (processBtn) processBtn.disabled = false;
            console.log("Process button re-enabled in finally block.");
        }
    });
}


// --- AI & Data Processing ---
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
        } else {
            reject(new Error("Failed to read file as ArrayBuffer."));
        }
    };
    reader.onerror = error => reject(error);
    reader.readAsArrayBuffer(file);
});

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
        } else {
            reject(new Error('File content could not be read as a data URL string or was null.'));
        }
    };
    reader.onerror = error => reject(error);
});

async function processText(text: string): Promise<MenuCategory[]> {
    console.log("processText: Starting for text of length", text.length);
    if (text.length > MAX_TEXT_LENGTH) {
        const chunks = chunkText(text, MAX_TEXT_LENGTH);
        if (loaderSubtitle) loaderSubtitle.textContent = `Menu énorme détecté. Analyse en ${chunks.length} parties...`;
        console.log(`processText: Text too long, processing in ${chunks.length} chunks.`);
        const processingPromises = chunks.map((chunk, i) => {
            if (loaderSubtitle) loaderSubtitle.textContent = `Analyse de la partie ${i + 1} sur ${chunks.length}...`;
            console.log(`processText: Calling Gemini for chunk ${i + 1}/${chunks.length}`);
            return callGeminiAPI(chunk, null);
        });
        const allResults: MenuCategory[][] = await Promise.all(processingPromises);
        console.log("processText: All chunks processed by Gemini.");
        return mergeResults(allResults);
    }
    console.log("processText: Calling Gemini for single text block.");
    return await callGeminiAPI(text, null);
}

async function processFiles(files: File[]): Promise<MenuCategory[]> {
    console.log(`processFiles: Starting for ${files.length} file(s).`);
    if (loaderSubtitle) loaderSubtitle.textContent = `Préparation de ${files.length} fichier(s) pour analyse...`;
    
    const processingPromises = files.map(async (file, index) => {
        console.log(`processFiles: Preparing file ${index + 1}/${files.length}: ${file.name} (type: ${file.type})`);
        if (loaderSubtitle) loaderSubtitle.textContent = `Traitement du fichier ${index + 1}/${files.length}: ${escapeHtml(file.name)}...`;
        
         if (typeof mammoth === 'undefined' && file.name.endsWith('.docx')) {
            console.error("Mammoth library is not loaded, but a .docx file was provided.");
            throw new Error("La librairie Mammoth n'est pas chargée. Impossible de traiter les fichiers .docx.");
         }

         if (file.name.endsWith('.docx')) {
             console.log(`processFiles: Reading .docx file ${file.name} with Mammoth.`);
             const arrayBuffer = await readFileAsArrayBuffer(file);
             const result = await mammoth.extractRawText({ arrayBuffer });
             console.log(`processFiles: .docx file ${file.name} converted to text, now processing text.`);
             return processText(result.value);
         } else {
             console.log(`processFiles: Converting file ${file.name} to base64.`);
             const base64Data = await toBase64(file);
             console.log(`processFiles: File ${file.name} converted to base64, calling Gemini.`);
             return await callGeminiAPI(null, { base64Data, mimeType: file.type });
         }
    });
    const allResults: MenuCategory[][] = await Promise.all(processingPromises);
    console.log("processFiles: All files processed by Gemini (or text extraction for docx).");
    return mergeResults(allResults);
}

function chunkText(text: string, maxLength: number): string[] {
    const chunks = [];
    let startIndex = 0;
    while (startIndex < text.length) {
        let endIndex = startIndex + maxLength;
        if (endIndex < text.length) {
            let lastNewline = text.lastIndexOf('\n', endIndex);
            // Ensure split point is reasonable, not too close to start
            if (lastNewline > startIndex + (maxLength / 3)) { 
                 endIndex = lastNewline;
            }
        }
        chunks.push(text.substring(startIndex, endIndex));
        startIndex = endIndex;
    }
    return chunks;
}

function mergeResults(results: MenuCategory[][]): MenuCategory[] {
    console.log("mergeResults: Starting with results:", JSON.parse(JSON.stringify(results)));
    const categoryMap = new Map<string, MenuCategory>();

    for (const resultSet of results) { // resultSet is MenuCategory[]
        if (!Array.isArray(resultSet)) {
            console.warn("mergeResults: Skipping non-array resultSet in merge:", resultSet);
            continue;
        }
        for (const category of resultSet) { // category is MenuCategory
            if (!category || typeof category.category !== 'string' || !Array.isArray(category.products)) {
                console.warn("mergeResults: Skipping malformed category object:", category);
                continue;
            }
            const categoryName = category.category.trim();
            if(!categoryName) {
                console.warn("mergeResults: Skipping category with empty name:", category);
                continue;
            }

            const existingCategory = categoryMap.get(categoryName);
            if (existingCategory) {
                // Ensure products array exists and merge, filtering invalid products if any
                existingCategory.products = existingCategory.products || [];
                const validNewProducts = category.products.filter(p => p && typeof p.name === 'string' && typeof p.price === 'number');
                existingCategory.products.push(...validNewProducts);
            } else {
                // Ensure the category being set also has valid products
                const validProducts = category.products.filter(p => p && typeof p.name === 'string' && typeof p.price === 'number');
                categoryMap.set(categoryName, { ...category, products: validProducts });
            }
        }
    }
    const merged = Array.from(categoryMap.values());
    console.log("mergeResults: Finished. Merged data:", JSON.parse(JSON.stringify(merged)));
    return merged;
}

// --- Validation Functions for AI Response ---
function isValidProduct(p: any): p is Product {
    const isValid = p &&
           typeof p.name === 'string' &&
           typeof p.price === 'number' &&
           typeof p.description === 'string' &&
           (p.volume_kilogram === undefined || p.volume_kilogram === null || typeof p.volume_kilogram === 'number') &&
           (p.volume_litre === undefined || p.volume_litre === null || typeof p.volume_litre === 'number') &&
           (p.abv_percentage === undefined || p.abv_percentage === null || typeof p.abv_percentage === 'number') &&
           (p.caffeine_mg === undefined || p.caffeine_mg === null || typeof p.caffeine_mg === 'number');
    if (!isValid) console.warn("isValidProduct: Invalid product detected", p);
    return isValid;
}

function isValidMenuCategory(item: any): item is MenuCategory {
    if (!(item && typeof item.category === 'string' && Array.isArray(item.products))) {
        console.warn("isValidMenuCategory: Invalid category structure (missing category name or products array)", item);
        return false;
    }
    const allProductsValid = item.products.every(isValidProduct);
    if (!allProductsValid) {
        console.warn("isValidMenuCategory: Category contains invalid products", item);
    }
    // Filter out invalid products directly if needed, or just return based on allValid
    // For now, let's ensure all products must be valid for the category to be valid.
    // Alternatively, we could filter: item.products = item.products.filter(isValidProduct); return true;
    return allProductsValid;
}


async function callGeminiAPI(text: string | null, fileData: { base64Data: string; mimeType: string } | null): Promise<MenuCategory[]> {
    console.log(`callGeminiAPI: Called with ${text ? 'text input' : 'file input'}.`);
    const systemInstructionContent = `Tu es un assistant expert en extraction de données de menus.
Analyse le menu fourni, QUI PEUT ÊTRE SOUS FORME DE TEXTE OU D'IMAGE.
SI L'ENTRÉE EST UNE IMAGE, tu DOIS effectuer une reconnaissance optique de caractères (OCR) pour en extraire le texte AVANT de procéder à l'analyse structurée.
Extrait les informations en un JSON VALIDE ET PUR. Le JSON doit être un tableau d'objets.
Chaque objet représente une catégorie et DOIT avoir les clés "category" (string) et "products" (array).
Chaque produit dans le tableau "products" DOIT être un objet avec les clés suivantes: "name" (string, obligatoire), "price" (number, obligatoire, si non trouvé mettre 0), "description" (string, obligatoire, si non trouvée mettre "Aucune description").
Les clés optionnelles pour un produit sont: "volume_kilogram" (number), "volume_litre" (number), "abv_percentage" (number), "caffeine_mg" (number). Si une valeur optionnelle n'est pas trouvée, elle doit être omise ou mise à null.
NE RENVOIE QUE LE JSON BRUT. Aucune explication, aucun commentaire, aucune note en dehors des valeurs JSON elles-mêmes.
Les valeurs de type string (comme la description) ne doivent contenir que le texte pertinent du menu, sans aucune annotation ou commentaire additionnel entre parenthèses ou autre.
Assure-toi que toutes les chaînes de caractères sont correctement échappées si nécessaire pour former un JSON valide.`;
    
    let apiContents: { parts: ({text: string} | {inlineData: {mimeType: string, data: string}})[] };

    if (fileData) {
        apiContents = {
            parts: [
                { text: "Analyse le menu fourni dans l'image ci-jointe, en respectant les instructions système. Effectue une OCR pour extraire le texte de l'image avant l'analyse." },
                { inlineData: { mimeType: fileData.mimeType, data: fileData.base64Data } }
            ]
        };
        console.log(`callGeminiAPI: Prepared image content for Gemini. MimeType: ${fileData.mimeType}`);
    } else if (text) {
        apiContents = { 
            parts: [
                { text: `Voici le menu à analyser (format texte):\n\n${text}\n\nExtrais les informations comme demandé par les instructions système.` }
            ]
        };
        console.log("callGeminiAPI: Prepared text content for Gemini.");
    } else {
        console.error("callGeminiAPI: No text or file data provided.");
        throw new Error("No text or file data provided to Gemini API.");
    }

    try {
        console.log("callGeminiAPI: Sending request to Gemini model 'gemini-2.5-flash-preview-04-17'.");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-04-17',
            contents: apiContents,
            config: {
                responseMimeType: "application/json",
                systemInstruction: systemInstructionContent
            }
        });
        console.log("callGeminiAPI: Received response from Gemini.");

        let jsonStr = response.text;
        if (!jsonStr) {
            console.error("callGeminiAPI: API Response was empty or text field missing:", response);
            throw new Error("L'IA n'a pas renvoyé de texte.");
        }
        jsonStr = jsonStr.trim();
        console.log("callGeminiAPI: Raw response text (trimmed):", jsonStr);

        const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[1]) {
          jsonStr = match[1].trim();
          console.log("callGeminiAPI: Extracted JSON from markdown fence:", jsonStr);
        }
        
        let parsedJson: any;
        try {
            parsedJson = JSON.parse(jsonStr);
        } catch(e: any) {
             console.error("callGeminiAPI: Failed to parse JSON response. String was:", jsonStr, "Error:", e);
             throw new Error(`L'IA a renvoyé une réponse JSON malformée: ${e.message}`);
        }

        console.log("callGeminiAPI: Successfully parsed JSON. Now validating structure...");
        
        let validatedData: MenuCategory[];

        if (Array.isArray(parsedJson)) {
            validatedData = parsedJson.filter(isValidMenuCategory);
            // Additionally, ensure products within valid categories are also valid
            validatedData.forEach(cat => {
                cat.products = cat.products.filter(isValidProduct);
            });
            // Filter out categories that might have ended up with no valid products after inner filter
            validatedData = validatedData.filter(cat => cat.products.length > 0 || cat.category); // Keep category if it has a name even if products are all filtered
             if (validatedData.length !== parsedJson.length) {
                console.warn("callGeminiAPI: Some categories or their products in the parsed array did not conform to the required structure and were filtered out.");
            }
        } else if (isValidMenuCategory(parsedJson)) {
            // Single category object
            parsedJson.products = parsedJson.products.filter(isValidProduct);
            if (parsedJson.products.length > 0 || parsedJson.category) {
                 validatedData = [parsedJson];
            } else {
                validatedData = [];
            }
            console.warn("callGeminiAPI: Parsed JSON was a single valid category object (or became empty after product filtering).");
        } else {
            console.error("callGeminiAPI: Parsed JSON is not an array of categories nor a single valid category object.");
            throw new Error("Le JSON retourné par l'IA n'est pas dans le format de catégories attendu après validation.");
        }
        
        console.log("callGeminiAPI: Validation complete. Returning validated data:", JSON.parse(JSON.stringify(validatedData)));
        return validatedData;

    } catch (error: any) {
        console.error("callGeminiAPI: Error calling Gemini API or processing its response:", error);
        let errorDetails = "Erreur lors de l'appel à l'API Gemini. ";
        if (error && error.message) {
            errorDetails += error.message;
        }
        throw new Error(errorDetails);
    }
}

function saveChangesFromEditor() {
    const updatedMenuData: MenuCategory[] = [];
    document.querySelectorAll<HTMLElement>('#step2 .category-block').forEach((catElement) => {
        const categoryNameInput = catElement.querySelector<HTMLInputElement>('.category-name-input');
        const categoryName = categoryNameInput ? categoryNameInput.value.trim() : "Catégorie Inconnue";
        
        const newCategory: MenuCategory = { category: categoryName, products: [] };
        
        catElement.querySelectorAll<HTMLElement>('.product-block').forEach((prodElement) => {
            const nameInput = prodElement.querySelector<HTMLInputElement>(`#${prodElement.getAttribute('aria-labelledby')}`); // Use ID for name
            const name = nameInput ? nameInput.value.trim() : "";
            if (!name) return; // Skip product if name is empty

            const priceInput = prodElement.querySelector<HTMLInputElement>(`input[data-field='price']`);
            const descriptionInput = prodElement.querySelector<HTMLTextAreaElement>(`textarea[data-field='description']`); // Use data-field for description
            const volumeKgInput = prodElement.querySelector<HTMLInputElement>(`input[data-field='volume_kilogram']`);
            const volumeLitreInput = prodElement.querySelector<HTMLInputElement>(`input[data-field='volume_litre']`);
            const abvInput = prodElement.querySelector<HTMLInputElement>(`input[data-field='abv_percentage']`);
            const caffeineInput = prodElement.querySelector<HTMLInputElement>(`input[data-field='caffeine_mg']`);
            
            newCategory.products.push({
                name: name,
                price: priceInput ? (parseFloat(priceInput.value) || 0) : 0,
                description: descriptionInput ? descriptionInput.value.trim() : '',
                volume_kilogram: volumeKgInput && volumeKgInput.value ? parseFloat(volumeKgInput.value) : null,
                volume_litre: volumeLitreInput && volumeLitreInput.value ? parseFloat(volumeLitreInput.value) : null,
                abv_percentage: abvInput && abvInput.value ? parseFloat(abvInput.value) : null,
                caffeine_mg: caffeineInput && caffeineInput.value ? parseFloat(caffeineInput.value) : null,
            });
        });
        // Only add category if it has a name or some products
        if (newCategory.category || newCategory.products.length > 0) {
            updatedMenuData.push(newCategory);
        }
    });
    menuData = updatedMenuData;
    console.log("saveChangesFromEditor: Menu data updated from editor:", JSON.parse(JSON.stringify(menuData)));
}

function generateOutputFiles() {
    categoriesOutput = menuData.map(cat => cat.category).join('\n');
    const header = "[sortid;extid;gtin;name;price_delivery;price_pickup;description;photo_url;volume_kilogram;volume_litre;abv_percentage;caffeine_mg;deposit_amount;tax_percentage;allergens;additives;nutrition_facts]#";
    let sortId = 1;
    const tmsLines = menuData.flatMap(category => 
        category.products.map((p: Product) => [
            sortId++, '', '', p.name, p.price.toFixed(2), p.price.toFixed(2), (p.description || '').replace(/[\n\r;]/g, ','), '',
            p.volume_kilogram ?? '', p.volume_litre ?? '', p.abv_percentage ?? '', p.caffeine_mg ?? '',
            '', '', '', '', ''
        ].join(';') + '#')
    );
    tmsOutput = header + '\n' + tmsLines.join('\n');
    console.log("generateOutputFiles: Output files generated.");
}

// --- Text Case Transformation Helpers ---
function toSentenceCase(str: string): string {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function toTitleCase(str: string): string {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => {
        if (word.length === 0) return "";
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// --- UI Rendering ---
function renderStep2() {
    console.log("renderStep2: Starting to build Step 2 HTML.");
    if (!step2) {
        console.error("renderStep2: Step 2 DOM element not found!");
        return;
    }
    step2.innerHTML = `<div class="flex items-center mb-6">
            <span class="bg-gradient-to-br from-green-500 to-teal-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl mr-4 shadow-md">2</span>
            <h2 class="text-3xl font-semibold text-gray-700">Valider et Corriger</h2>
        </div>
        <p class="text-gray-600 mb-8">Vérifiez les données extraites. Cliquez sur "Détails" pour les champs optionnels. Modifiez, ajoutez ou supprimez des éléments au besoin.</p>
        <div id="menu-editor" class="space-y-6" role="form" aria-labelledby="menu-editor-heading">
          <span id="menu-editor-heading" class="sr-only">Éditeur de menu</span>
        </div>
         <div class="mt-8 border-t border-gray-200 pt-6">
            <button id="add-category-btn" class="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm">+ Ajouter une catégorie</button>
        </div>
        <div class="mt-8 text-center">
            <button id="confirm-btn" class="btn-primary text-white font-bold py-3 px-8 rounded-lg text-lg bg-gradient-to-r from-green-500 to-teal-400">Confirmer et Générer</button>
        </div>`;
    
    const addCategoryBtn = document.getElementById('add-category-btn') as HTMLButtonElement | null;
    if (addCategoryBtn) addCategoryBtn.onclick = addCategory;
    
    const confirmBtn = document.getElementById('confirm-btn') as HTMLButtonElement | null;
    if (confirmBtn) confirmBtn.onclick = () => {
        console.log("Confirm button (Step 2) clicked.");
        saveChangesFromEditor();
        generateOutputFiles();
        renderStep3();
        if (step2) step2.classList.add('hidden');
        if (step3) step3.classList.remove('hidden');
        console.log("Navigated to Step 3.");
    };
    renderMenuEditor();
    console.log("renderStep2: Finished building Step 2 HTML and attaching event listeners.");
}

function renderMenuEditor() {
    console.log("renderMenuEditor: Starting. Current menuData:", JSON.parse(JSON.stringify(menuData)));
    const editor = document.getElementById('menu-editor');
    if (!editor) {
        console.error("renderMenuEditor: Menu editor DOM element not found!");
        return;
    }
    editor.innerHTML = '';
    if (!menuData || menuData.length === 0) {
        editor.innerHTML = `<p class="text-center text-gray-500 py-8">Aucune donnée de menu à afficher. L'IA n'a peut-être rien trouvé ou les données étaient invalides. Vous pouvez essayer d'ajouter une catégorie manuellement.</p>`;
        console.log("renderMenuEditor: menuData is empty, showing empty message.");
        return;
    }

    menuData.forEach((category: MenuCategory, categoryIndex: number) => {
        const categoryBlock = document.createElement('div');
        categoryBlock.className = 'category-block border border-gray-200 rounded-xl p-4 shadow-sm bg-white';
        categoryBlock.setAttribute('aria-labelledby', `category-heading-${categoryIndex}`);
        
        categoryBlock.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div class="flex-grow flex items-center mr-2"> <!-- Wrapper for input and pencil -->
                    <label for="category-name-${categoryIndex}" class="sr-only">Nom de la catégorie</label>
                    <input id="category-name-${categoryIndex}" type="text" value="${escapeHtml(category.category)}" 
                           class="category-name-input text-2xl font-semibold border-b-2 border-transparent focus:border-purple-500 focus:outline-none bg-transparent flex-grow" 
                           placeholder="Nom de la catégorie" data-case-cycle-index="0">
                    <button data-action="cycle-case" data-category-index="${categoryIndex}" 
                            aria-label="Changer la casse de la catégorie ${escapeHtml(category.category)}" 
                            title="Changer la casse (Majuscules, Phrase, Titre)"
                            class="text-gray-500 hover:text-purple-600 transition p-1 ml-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-300 flex-shrink-0">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12V7.172l3-3L10.828 7 8 9.828V12H5zM15 14H5a1 1 0 00-1 1v2a1 1 0 001 1h10a1 1 0 001-1v-2a1 1 0 00-1-1z"></path></svg>
                    </button>
                </div>
                <button data-action="delete-category" data-index="${categoryIndex}" 
                        aria-label="Supprimer la catégorie ${escapeHtml(category.category)}" 
                        class="text-gray-400 hover:text-red-500 transition p-1 rounded-full flex-shrink-0">
                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>
                </button>
            </div>
            <div class="products-container space-y-4"></div>
            <button data-action="add-product" data-category-index="${categoryIndex}" class="mt-4 bg-purple-100 text-purple-800 font-semibold py-1 px-3 rounded-lg hover:bg-purple-200 transition-colors text-sm">+ Ajouter un produit à ${escapeHtml(category.category)}</button>
        `;
        const productsContainer = categoryBlock.querySelector<HTMLDivElement>('.products-container');
        if (productsContainer) {
            (category.products || []).forEach((product: Product, productIndex: number) => {
                productsContainer.appendChild(createProductRow(product, categoryIndex, productIndex));
            });
        }
        editor.appendChild(categoryBlock);
    });

    editor.querySelectorAll<HTMLButtonElement>('button[data-action="delete-category"]').forEach(btn => {
        btn.onclick = () => {
            if (btn.dataset.index) {
                 deleteCategory(parseInt(btn.dataset.index));
            }
        };
    });
    editor.querySelectorAll<HTMLButtonElement>('button[data-action="add-product"]').forEach(btn => {
        btn.onclick = () => {
            if (btn.dataset.categoryIndex) {
                addProductToCategory(parseInt(btn.dataset.categoryIndex));
            }
        };
    });
    editor.querySelectorAll<HTMLButtonElement>('button[data-action="cycle-case"]').forEach(btn => {
        btn.onclick = () => {
            if (btn.dataset.categoryIndex) {
                 cycleCategoryCase(parseInt(btn.dataset.categoryIndex));
            }
        };
    });
    editor.querySelectorAll<HTMLButtonElement>('button[data-action="cycle-field-case"]').forEach(btn => {
        btn.onclick = () => {
            const categoryIndex = btn.dataset.categoryIndex;
            const productIndex = btn.dataset.productIndex;
            const fieldType = btn.dataset.fieldType as 'name' | 'description' | undefined;

            if (categoryIndex && productIndex && fieldType) {
                 cycleFieldCase(parseInt(categoryIndex), parseInt(productIndex), fieldType);
            }
        };
    });
    console.log("renderMenuEditor: Finished rendering categories and products.");
}

function createProductRow(product: Product, categoryIndex: number, productIndex: number): HTMLDivElement {
    const block = document.createElement('div');
    block.className = 'product-block bg-gray-50 p-4 rounded-lg border border-gray-200';
    // Use unique ID for product block to help querySelector in saveChangesFromEditor
    block.setAttribute('aria-labelledby', `product-name-${categoryIndex}-${productIndex}`);


    // Safely access properties, defaulting if necessary (though validation should prevent most issues)
    const productName = product.name || "";
    const productPrice = (typeof product.price === 'number' ? product.price : 0).toFixed(2);
    const productDescription = product.description || "";
    const pencilIconSVG = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12V7.172l3-3L10.828 7 8 9.828V12H5zM15 14H5a1 1 0 00-1 1v2a1 1 0 001 1h10a1 1 0 001-1v-2a1 1 0 00-1-1z"></path></svg>`;

    block.innerHTML = `
        <div class="main-row grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 items-start">
            <div class="md:col-span-4">
                <label for="product-name-${categoryIndex}-${productIndex}" class="block text-xs font-medium text-gray-600">Nom du produit</label>
                <div class="flex items-center mt-1">
                    <input id="product-name-${categoryIndex}-${productIndex}" class="w-full p-2 border border-gray-300 rounded-md text-sm flex-grow" type="text" data-field="name" value="${escapeHtml(productName)}" placeholder="Nom" data-case-cycle-index="0">
                    <button data-action="cycle-field-case" data-category-index="${categoryIndex}" data-product-index="${productIndex}" data-field-type="name"
                            aria-label="Changer la casse du nom du produit" 
                            title="Changer la casse (Majuscules, Phrase, Titre)"
                            class="text-gray-500 hover:text-purple-600 transition p-1 ml-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-300 flex-shrink-0">
                        ${pencilIconSVG}
                    </button>
                </div>
            </div>
            <div class="md:col-span-2">
                <label for="product-price-${categoryIndex}-${productIndex}" class="block text-xs font-medium text-gray-600">Prix</label>
                <input id="product-price-${categoryIndex}-${productIndex}" class="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm" type="number" step="0.01" data-field="price" value="${productPrice}" placeholder="Prix">
            </div>
            <div class="md:col-span-4">
                <label for="product-desc-${categoryIndex}-${productIndex}" class="block text-xs font-medium text-gray-600">Description</label>
                <div class="flex items-start mt-1">
                    <textarea id="product-desc-${categoryIndex}-${productIndex}" class="w-full p-2 border border-gray-300 rounded-md text-sm h-12 flex-grow" data-field="description" placeholder="Ingrédients..." data-case-cycle-index="0">${escapeHtml(productDescription)}</textarea>
                    <button data-action="cycle-field-case" data-category-index="${categoryIndex}" data-product-index="${productIndex}" data-field-type="description"
                            aria-label="Changer la casse de la description" 
                            title="Changer la casse (Majuscules, Phrase, Titre)"
                            class="text-gray-500 hover:text-purple-600 transition p-1 ml-2 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-300 flex-shrink-0">
                        ${pencilIconSVG}
                    </button>
                </div>
            </div>
            <div class="md:col-span-2 flex items-center justify-end space-x-2 self-center pt-5">
                <button class="toggle-details-btn text-sm text-purple-600 hover:text-purple-800 font-medium p-2 rounded-md hover:bg-purple-50" aria-expanded="false">Détails</button>
                <button data-action="delete-product" data-category-index="${categoryIndex}" data-product-index="${productIndex}" aria-label="Supprimer le produit ${escapeHtml(productName)}" class="text-gray-400 hover:text-red-600 p-2 rounded-md hover:bg-red-50">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
        <div class="details-row mt-4 pt-4 border-t border-gray-200 hidden" aria-hidden="true">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label for="product-volkg-${categoryIndex}-${productIndex}" class="block text-xs font-medium text-gray-600">Volume (kg)</label><input id="product-volkg-${categoryIndex}-${productIndex}" class="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm" type="number" step="0.001" data-field="volume_kilogram" value="${product.volume_kilogram ?? ''}" placeholder="ex: 0.5"></div>
                <div><label for="product-voll-${categoryIndex}-${productIndex}" class="block text-xs font-medium text-gray-600">Volume (L)</label><input id="product-voll-${categoryIndex}-${productIndex}" class="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm" type="number" step="0.01" data-field="volume_litre" value="${product.volume_litre ?? ''}" placeholder="ex: 0.75"></div>
                <div><label for="product-abv-${categoryIndex}-${productIndex}" class="block text-xs font-medium text-gray-600">Alcool (%)</label><input id="product-abv-${categoryIndex}-${productIndex}" class="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm" type="number" step="0.1" data-field="abv_percentage" value="${product.abv_percentage ?? ''}" placeholder="ex: 12.5"></div>
                <div><label for="product-caff-${categoryIndex}-${productIndex}" class="block text-xs font-medium text-gray-600">Caféine (mg)</label><input id="product-caff-${categoryIndex}-${productIndex}" class="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm" type="number" step="1" data-field="caffeine_mg" value="${product.caffeine_mg ?? ''}" placeholder="ex: 80"></div>
            </div>
        </div>`;
    
    const toggleBtn = block.querySelector<HTMLButtonElement>('.toggle-details-btn');
    if (toggleBtn) {
        toggleBtn.onclick = (e) => {
            const targetButton = e.target as HTMLButtonElement;
            const productBlock = targetButton.closest('.product-block');
            if (productBlock) {
                const detailsRow = productBlock.querySelector<HTMLDivElement>('.details-row');
                if (detailsRow) {
                    const isHidden = detailsRow.classList.toggle('hidden'); 
                    targetButton.textContent = !isHidden ? 'Moins de détails' : 'Détails';
                    targetButton.setAttribute('aria-expanded', (!isHidden).toString());
                    detailsRow.setAttribute('aria-hidden', isHidden.toString());
                     if (!isHidden) { 
                        detailsRow.classList.add('open');
                    } else {
                         detailsRow.classList.remove('open');
                    }
                }
            }
        };
    }
    const deleteBtn = block.querySelector<HTMLButtonElement>('button[data-action="delete-product"]');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (deleteBtn.dataset.categoryIndex && deleteBtn.dataset.productIndex) {
                 deleteProductFromCategory(parseInt(deleteBtn.dataset.categoryIndex), parseInt(deleteBtn.dataset.productIndex));
            }
        };
    }
    return block;
}

function renderStep3() {
    console.log("renderStep3: Starting to build Step 3 HTML.");
    if (!step3) {
        console.error("renderStep3: Step 3 DOM element not found!");
        return;
    }
    step3.innerHTML = `<div class="flex items-center mb-6"><span class="bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl mr-4 shadow-md">3</span><h2 class="text-3xl font-semibold text-gray-700">Télécharger les Fichiers</h2></div><p class="text-gray-600 mb-8">Votre menu est prêt à être exporté.</p><div class="flex flex-col md:flex-row justify-center items-center gap-6"><button id="download-categories-btn-final" class="bg-white border border-purple-300 text-purple-700 font-bold py-3 px-8 rounded-lg hover:bg-purple-50 transition-colors w-full md:w-auto">Télécharger les Catégories (.txt)</button><button id="download-tms-btn-final" class="btn-primary text-white font-bold py-3 px-8 rounded-lg w-full md:w-auto">Télécharger le Menu TMS (.txt)</button></div><div class="mt-12"><button id="restart-btn-final" class="text-gray-500 font-medium hover:text-purple-600 transition">Convertir un autre menu</button></div>`;
    
    const downloadCatBtn = document.getElementById('download-categories-btn-final') as HTMLButtonElement | null;
    if (downloadCatBtn) downloadCatBtn.onclick = () => downloadFile(categoriesOutput, 'categories.txt', 'text/plain');
    
    const downloadTmsBtn = document.getElementById('download-tms-btn-final') as HTMLButtonElement | null;
    if (downloadTmsBtn) downloadTmsBtn.onclick = () => downloadFile(tmsOutput, 'menu_tms.txt', 'text/plain');

    const restartBtn = document.getElementById('restart-btn-final') as HTMLButtonElement | null;
    if (restartBtn) restartBtn.onclick = resetApp;
    console.log("renderStep3: Finished building Step 3 HTML and attaching event listeners.");
}

// --- UI Action Functions ---
function cycleCategoryCase(categoryIndex: number) {
    const categoryInput = document.getElementById(`category-name-${categoryIndex}`) as HTMLInputElement | null;
    const cycleButton = document.querySelector<HTMLButtonElement>(`button[data-action="cycle-case"][data-category-index="${categoryIndex}"]`);

    if (!categoryInput || !cycleButton) {
        console.warn(`Could not find input or button for category index ${categoryIndex} to cycle case.`);
        return;
    }

    let currentText = categoryInput.value;
    let cycleState = parseInt(categoryInput.dataset.caseCycleIndex || "0");

    switch (cycleState) {
        case 0: // Current -> UPPERCASE
            currentText = currentText.toUpperCase();
            categoryInput.dataset.caseCycleIndex = "1";
            break;
        case 1: // Current -> Sentence case
            currentText = toSentenceCase(currentText);
            categoryInput.dataset.caseCycleIndex = "2";
            break;
        case 2: // Current -> Title Case
            currentText = toTitleCase(currentText);
            categoryInput.dataset.caseCycleIndex = "0"; // Cycle back
            break;
        default: 
            categoryInput.dataset.caseCycleIndex = "0"; // Reset to default if state is unknown
            break;
    }
    categoryInput.value = currentText;
    
    // Update aria-label for the pencil button as category name might have changed
    cycleButton.setAttribute('aria-label', `Changer la casse de la catégorie ${escapeHtml(currentText)}`);
    // Also update the aria-label for the delete category button
    const deleteCategoryButton = document.querySelector<HTMLButtonElement>(`button[data-action="delete-category"][data-index="${categoryIndex}"]`);
    if (deleteCategoryButton) {
        deleteCategoryButton.setAttribute('aria-label', `Supprimer la catégorie ${escapeHtml(currentText)}`);
    }
    // And update the "Add product to category" button text
    const addProductButton = document.querySelector<HTMLButtonElement>(`button[data-action="add-product"][data-category-index="${categoryIndex}"]`);
    if (addProductButton) {
        addProductButton.textContent = `+ Ajouter un produit à ${escapeHtml(currentText)}`;
    }
}

function cycleFieldCase(categoryIndex: number, productIndex: number, fieldType: 'name' | 'description') {
    const elementId = fieldType === 'name' ? `product-name-${categoryIndex}-${productIndex}` : `product-desc-${categoryIndex}-${productIndex}`;
    const inputElement = document.getElementById(elementId) as HTMLInputElement | HTMLTextAreaElement | null;

    if (!inputElement) {
        console.warn(`cycleFieldCase: Could not find input for C:${categoryIndex}, P:${productIndex}, F:${fieldType}`);
        return;
    }

    let currentText = inputElement.value;
    let cycleState = parseInt(inputElement.dataset.caseCycleIndex || "0");

    switch (cycleState) {
        case 0: // Current -> UPPERCASE
            currentText = currentText.toUpperCase();
            inputElement.dataset.caseCycleIndex = "1";
            break;
        case 1: // Current -> Sentence case
            currentText = toSentenceCase(currentText);
            inputElement.dataset.caseCycleIndex = "2";
            break;
        case 2: // Current -> Title Case
            currentText = toTitleCase(currentText);
            inputElement.dataset.caseCycleIndex = "0"; // Cycle back
            break;
        default:
            inputElement.dataset.caseCycleIndex = "0"; // Reset
            break;
    }
    inputElement.value = currentText;

    if (fieldType === 'name') {
        const deleteProductButton = document.querySelector<HTMLButtonElement>(
            `button[data-action="delete-product"][data-category-index="${categoryIndex}"][data-product-index="${productIndex}"]`
        );
        if (deleteProductButton) {
            deleteProductButton.setAttribute('aria-label', `Supprimer le produit ${escapeHtml(currentText)}`);
        }
        // Update aria-labelledby for the product block if product name changes
        const productBlock = inputElement.closest('.product-block');
        if (productBlock) {
             // The aria-labelledby is already set to the input's ID, which doesn't change.
             // However, if we wanted to update a visible heading that used the name, this would be the place.
        }
    }
}


function addCategory() {
    console.log("addCategory: Adding new category.");
    menuData.push({ category: "Nouvelle Catégorie", products: [{ name: "Nouveau Produit", price: 0, description: "Description par défaut" }] });
    renderMenuEditor();
}

function deleteCategory(categoryIndex: number) {
    console.log(`deleteCategory: Deleting category at index ${categoryIndex}.`);
    if (categoryIndex >= 0 && categoryIndex < menuData.length) {
        menuData.splice(categoryIndex, 1);
        renderMenuEditor();
    } else {
        console.warn(`deleteCategory: Invalid index ${categoryIndex}.`);
    }
}

function addProductToCategory(categoryIndex: number) {
    console.log(`addProductToCategory: Adding product to category index ${categoryIndex}.`);
    if (menuData[categoryIndex]) {
        if (!menuData[categoryIndex].products) { // Should not happen with new types, but good safeguard
            menuData[categoryIndex].products = [];
        }
        menuData[categoryIndex].products.push({ name: "Nouveau produit", price: 0, description: "Description par défaut" });
        renderMenuEditor();
    } else {
         console.warn(`addProductToCategory: Invalid category index ${categoryIndex}.`);
    }
}

function deleteProductFromCategory(categoryIndex: number, productIndex: number) {
     console.log(`deleteProductFromCategory: Deleting product at [${categoryIndex}][${productIndex}].`);
    if (menuData[categoryIndex] && menuData[categoryIndex].products &&
        productIndex >= 0 && productIndex < menuData[categoryIndex].products.length) {
        menuData[categoryIndex].products.splice(productIndex, 1);
        renderMenuEditor();
    } else {
        console.warn(`deleteProductFromCategory: Invalid indices [${categoryIndex}][${productIndex}].`);
    }
}

function resetApp() {
    console.log("resetApp: Resetting application state to initial.");
    if (step3) step3.classList.add('hidden');
    if (step2) step2.classList.add('hidden');
    if (step1) step1.classList.remove('hidden');
    if (textInput) {
        textInput.value = '';
        textInput.disabled = false;
    }
    uploadedFiles = [];
    menuData = [];
    renderGallery(); // Clears previews
    hideError();
    if (loaderSubtitle) loaderSubtitle.textContent = '';
    // Revoke Object URLs for previews
    if(galleryPreview) {
        galleryPreview.querySelectorAll<HTMLImageElement>('img[src^="blob:"]').forEach(img => {
             if (img.src) URL.revokeObjectURL(img.src);
        });
    }
     console.log("resetApp: Application reset complete.");
}

// --- Utility Functions ---
function showError(message: string) {
    const appElement = document.getElementById('app');
    if (!appElement) {
        console.error("showError: App element not found for displaying error.");
        return;
    }

    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
         errorDiv = document.createElement('div');
         errorDiv.id = 'error-message';
         // Insert error message after the header, before the first step/card
         const headerElement = document.querySelector('header');
         if (headerElement && headerElement.nextElementSibling) {
            headerElement.parentElement?.insertBefore(errorDiv, headerElement.nextElementSibling);
         } else if (appElement.firstChild) { // Fallback to inserting inside app div
            appElement.insertBefore(errorDiv, appElement.firstChild);
         } else {
            appElement.appendChild(errorDiv);
         }
    }
    errorDiv.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6 shadow-md';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.innerHTML = `<p class="font-bold">Erreur</p><p>${escapeHtml(message)}</p>`;
    errorDiv.classList.remove('hidden');
    console.log("showError: Displayed error message - ", message);
}

function hideError() {
    const el = document.getElementById('error-message');
    if (el) el.classList.add('hidden');
}

function escapeHtml(unsafe: any): string {
    if (typeof unsafe !== 'string') {
        unsafe = String(unsafe === null || unsafe === undefined ? "" : unsafe);
    }
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function downloadFile(content: string, fileName: string, contentType: string) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    console.log(`downloadFile: Triggered download for ${fileName}.`);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Application initialized and ready.");
    // Initial UI setup
    if (step1) step1.classList.remove('hidden');
    if (step2) step2.classList.add('hidden');
    if (step3) step3.classList.add('hidden');
    if (loader) loader.classList.add('hidden');
});
