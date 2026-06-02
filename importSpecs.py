import os
import zipfile
import re
import json
import pypdf

ZIP_PATH = "c:/Documents/A4/Satge/OneDrive_2026-05-20.zip"
OUTPUT_TS_PATH = "src/data/initialSpecs.ts"

CANONICAL_MAP = {
    # Spanish to English
    "Pureza": "Purity",
    "Agua": "Water",
    "Humedad": "Water",
    "Acidez": "Acidity",
    "Apariencia": "Appearance",
    "Aspecto": "Appearance",
    "Cloruros": "Chlorides",
    "Hierro": "Iron",
    "Sulfatos": "Sulfates",
    "Densidad": "Density",
    "Cenizas": "Ash",
    "Gravedad Específica": "Specific Gravity",
    "Gravedad específica": "Specific Gravity",
    "Gravedad esp.": "Specific Gravity",
    "Peso Específico": "Specific Gravity",
    "Densidad Relativa": "Specific Gravity",
    "Punto de inflamación": "Flash Point",
    "Punto de inflamacion": "Flash Point",
    "Punto de ignición": "Flash Point",
    "Punto de ignicion": "Flash Point",
    "Índice de refracción": "Refractive Index",
    "Indice de refraccion": "Refractive Index",
    "Metales pesados": "Heavy Metals",
    "Viscosidad": "Viscosity",
    "Rango de destilación": "Distillation range",
    "Rango de destilacion": "Distillation range",
    "Aldehídos": "Aldehydes",
    "Aldehido": "Aldehydes",
    "Índice de saponificación": "Saponification Value",
    "Indice de saponificacion": "Saponification Value",
    "Índice de yodo": "Iodine Value",
    "Indice de yodo": "Iodine Value",
    "Pérdida al secado": "Loss on drying",
    "Perdida al secado": "Loss on drying",
    "Turbidez": "Turbidity",
    "Turbiedad": "Turbidity",
    
    # Portuguese to English
    "Teor": "Purity",
    
    # English/OCR cleanups
    "Assay": "Purity",
    "Water": "Water",
    "Moisture": "Water",
    "Acidity (as Acetic Acid)": "Acidity",
    "Acidity as Acetic Acid": "Acidity",
    "Acidity, as Acetic Acid": "Acidity",
    "Color": "Color",
    "Color APHA": "Color",
    "Chlorides": "Chlorides",
    "Chloride": "Chlorides",
    "H2O": "Water",
    "Humidity": "Water",
    "W ater": "Water",
    "W ater Content": "Water",
    "Aci dity Index": "Acidity",
    "Aci dity as Ace tic": "Acidity",
    "Purity, USP": "Purity",
    "Flash point": "Flash Point",
    "Acid value": "Acidity",
    "Acid Value": "Acidity",
    "Acidity Value": "Acidity",
    "Acidity Index": "Acidity",
    "Aci dity Index": "Acidity",
    "Specific gravity": "Specific Gravity",
    "Specific gravity @60": "Specific Gravity",
    "Specific gravity (15.6 / 15.6°c)": "Specific Gravity",
    "Specific Gravity 25°C": "Specific Gravity",
}

# Lowercase lookup dictionary for robustness
CANONICAL_MAP_LOWER = {k.lower().strip(): v for k, v in CANONICAL_MAP.items()}

STANDARD_SYNONYM_MAP = {
    "Purity": [
        "purity", "purety", "purity by gc", "gc purity", "purity (gc)", "assay",
        "assay by gc", "content", "active content", "active ingredient",
        "purity (glc)", "main component", "principal component",
        "titre", "titer", "minimum purity", "min purity",
        "pureza", "pureza por gc", "riqueza", "contenido activo", "contenido",
        "pureté", "teor"
    ],
    "Water": [
        "water", "water content", "moisture", "moisture content",
        "water content (kf)", "water (kf)", "h2o", "h 2o",
        "karl fischer", "kf", "kf water", "water by kf",
        "water determination", "humidity", "water determination (kf)",
        "water content by kf", "w ater", "w ater content",
        "agua", "humedad", "contenido de agua", "agua (kf)",
        "determinación de agua", "humedad por kf",
        "eau", "teneur en eau", "humidité"
    ],
    "Acidity": [
        "acidity", "acid value", "acid number", "free acidity",
        "total acidity", "acidity as acetic acid", "acidity (as acetic acid)",
        "acidity as ch3cooh", "acidity, as acetic acid", "acidity, like acetic acid",
        "acidity as metacrylic acid", "acidity as methacrylic acid",
        "acidic content", "acid content", "acidity index",
        "aci dity index", "aci dity as ace tic",
        "acidez", "valor de acidez", "número de acidez", "acidez libre",
        "acidez total", "índice de acidez",
        "acidité", "indice d'acide"
    ],
    "Appearance": [
        "appearance", "visual", "aspect", "description",
        "physical description", "colour and appearance",
        "color and appearance", "visual inspection",
        "apperance", "appearence", "look", "clarity",
        "appearance at 25°c", "appearance @25°c", "appearance at 30°c",
        "apariencia", "aspecto", "aspecto visual", "descripción", "aspecto físico",
        "apparence"
    ],
    "Color": [
        "color", "colour", "apha", "pt-co", "pt/co", "hazen",
        "color apha", "colour apha", "color (pt-co)", "color pt-co",
        "color (apha)", "color (hazen)", "hazen color", "hazen colour",
        "color number", "colour number", "saybolt color",
        "gardner color", "gardner colour", "platinum cobalt",
        "color (molten)", "color (thermal stability 250°c, 90 min.)",
        "color difference value b", "color, (100 mm cell)",
        "color (5% solution in distilled water)",
        "color (in aqueous solution at 50%)",
        "índice de color",
        "couleur", "indice de couleur"
    ],
    "Chlorides": [
        "chlorides", "chloride", "cl-", "chloride content",
        "chlorides (cl-)", "chloride (as cl)", "chloride (cl)",
        "total chloride", "chlorinated compounds", "chlorine",
        "cloruros", "cloruro", "contenido de cloruros", "cloro",
        "chlorures", "chlorure"
    ],
    "Specific Gravity": [
        "specific gravity", "sg", "relative density", "specific density",
        "d20/4", "d25/4", "d 20/4", "density 20/20", "sp. gr.",
        "specific gravity 20/20", "specific gravity 20/20°c",
        "specific gravity 25°c", "specific gravity 60/60 °f",
        "specific gravity @ 23.88°c", "specific gravity @60°f",
        "specific gravity at 20 °c", "specific gravity, 20/20",
        "specific gravity (15.6 / 15.6°c)", "specific gravity @20/20°c",
        "specific gravity @25/25°c", "specific gravity @60",
        "specific weight", "specific weight 20/20°c", "specific weight @25°c",
        "gravedad específica", "peso específico", "densidad relativa",
        "gravedad esp.", "gravedad especifica",
        "densité relative", "densité spécifique"
    ],
    "Density": [
        "density", "density 20° c", "density @ 59 °f",
        "density @15.6/15.6°c", "density at 15°c", "density at 20°c",
        "bulk density", "relative density",
        "densidad", "densidad a 20°c", "densidad relativa",
        "densité", "masse volumique"
    ],
    "Flash Point": [
        "flash point", "flash pt", "fp", "flash", "flash, tcc",
        "flammability", "ignition point",
        "punto de inflamación", "punto de ignición", "punto de llama",
        "point d'éclair", "point d'inflammation"
    ],
    "Refractive Index": [
        "refractive index", "refraction index", "ri", "n20d", "nd20",
        "refractive index 20 °c", "refractive index @25c",
        "refractive index, @20°c",
        "índice de refracción", "indice de refraccion",
        "indice de réfraction"
    ],
    "Iron": [
        "iron", "iron (fe)", "fe", "iron content", "fe content",
        "heavy metals as fe", "iron (iii) oxide (fe", "total iron",
        "hierro", "contenido de hierro", "hierro (fe)",
        "fer", "teneur en fer"
    ],
    "Heavy Metals": [
        "heavy metals", "heavy metals (as pb)", "heavy metals as pb",
        "heavy metals (such as pb)", "total heavy metals", "total metal",
        "metales pesados", "metales pesados como pb",
        "métaux lourds"
    ],
    "Viscosity": [
        "viscosity", "viscosity 25 °c", "viscosity @ 40°c",
        "viscosity @25°c", "viscosity lvt", "viscosity at 20°c",
        "kinematic viscosity", "dynamic viscosity",
        "viscosidad", "viscosidad a 25°c",
        "viscosité"
    ],
    "pH": [
        "ph", "ph value", "ph (10% aqueous)", "ph (5% aq)", "ph (5% solition)",
        "ph (in aqueous solution at 5%) @25°c", "ph in 4% aqueous solution",
        "ph in 50/50 solution", "reaction (ph)",
        "valor de ph"
    ],
    "Distillation range": [
        "distillation range", "distillation", "boiling range",
        "boiling point", "bp", "distillation range 1 atm",
        "distillation range (56.1°c)", "initial boiling point",
        "final boiling point", "ibp", "ebp",
        "rango de destilación", "punto de ebullición", "intervalo de destilación",
        "intervalle de distillation", "point d'ébullition"
    ],
    "Methanol": [
        "methanol", "methyl alcohol", "wood alcohol", "meoh",
        "metanol", "alcohol metílico"
    ],
    "Aldehydes": [
        "aldehydes", "aldehyde", "aldehyde content", "carbonyl compounds",
        "aldehydes (as bal)", "acetaldehyde",
        "aldehídos", "aldehido", "contenido de aldehídos",
        "aldéhydes"
    ],
    "Saponification Value": [
        "saponification value", "saponification index", "sap value",
        "saponification number",
        "índice de saponificación", "valor de saponificación",
        "indice de saponification"
    ],
    "Iodine Value": [
        "iodine value", "iodine index", "iodine number",
        "iodine index, (wij's) g",
        "índice de yodo", "valor de yodo",
        "indice d'iode"
    ],
    "Loss on drying": [
        "loss on drying", "loss drying", "lod", "moisture loss",
        "drying loss",
        "pérdida al secado", "pérdida por secado",
        "perte à la dessiccation"
    ],
    "Sulfate": [
        "sulfate", "sulphate", "so4", "sulfate (so4)",
        "sulfate (as so4)", "sulphate (so4)", "sulfate ion", "sulfates",
        "sulfato", "sulfatos", "contenido de sulfatos"
    ],
    "Turbidity": [
        "turbidity", "haze", "clarity", "ntu",
        "turbidez", "turbiedad",
        "turbidité"
    ]
}

def get_parameter_synonyms(canonical_name, raw_desc):
    synonyms = []
    
    # 1. Exact match in STANDARD_SYNONYM_MAP
    if canonical_name in STANDARD_SYNONYM_MAP:
        synonyms = [s.strip().lower() for s in STANDARD_SYNONYM_MAP[canonical_name]]
    else:
        # 2. Check prefix / substring matches for dynamic suffix generation
        matched_key = None
        for key in STANDARD_SYNONYM_MAP:
            if key.lower() in canonical_name.lower():
                matched_key = key
                break
        
        if matched_key:
            base_syns = [s.strip().lower() for s in STANDARD_SYNONYM_MAP[matched_key]]
            
            # Find suffix by stripping matched_key from canonical_name
            idx = canonical_name.lower().find(matched_key.lower())
            suffix = canonical_name[idx + len(matched_key):]
            
            # Generate synonyms with suffix
            for bs in base_syns:
                syn = bs + suffix.lower()
                synonyms.append(syn)
                # Also generate without degree symbol if present
                if "°" in syn:
                    synonyms.append(syn.replace("°", ""))
                # Also replace '@' with 'a' or 'at' for Spanish/English
                if "@" in syn:
                    synonyms.append(syn.replace("@", "a"))
                    synonyms.append(syn.replace("@", "at"))
        else:
            synonyms = [canonical_name.lower().strip()]
            
    # Add raw description as a synonym if not present
    raw_desc_lower = raw_desc.lower().strip()
    if raw_desc_lower not in synonyms:
        synonyms.append(raw_desc_lower)
        
    return synonyms

def get_best_spec_file(z, product_dir):
    files = [n for n in z.namelist() if n.startswith(f"0 - Product Catalog/{product_dir}/") and 
             ("spec" in n.lower() or "especific" in n.lower() or "specific" in n.lower() or "coaf" in n.lower() or "certificado" in n.lower())]
    if not files:
        return None
    
    # Priority 1: USA folder specifications
    usa_specs = [f for f in files if "_usa/" in f.lower()]
    if usa_specs:
        return usa_specs[0]
        
    # Priority 2: English / USA specifications (does not contain _SP, _EU, _BRA, _MX etc. in path, or contains USA/EN)
    en_specs = [f for f in files if "specification" in f.lower() or "english" in f.lower()]
    if en_specs:
        return en_specs[0]
        
    # Priority 3: Non-localized or standard specs
    en_by_exclusion = [f for f in files if not any(x in f.lower() for x in ["_sp_", "_bra_", "_mx_", "_pt_", "_br_", "_eu/especific", "_es/especific"])]
    if en_by_exclusion:
        return en_by_exclusion[0]
        
    # Priority 4: Spanish specifications
    sp_specs = [f for f in files if "especificaci" in f.lower() or "espanol" in f.lower() or "sp_eu" in f.lower() or "_mx" in f.lower()]
    if sp_specs:
        return sp_specs[0]
        
    # Priority 5: Portuguese specifications
    pt_specs = [f for f in files if "especifica" in f.lower() or "portugues" in f.lower() or "_bra" in f.lower()]
    if pt_specs:
        return pt_specs[0]
        
    return files[0]

def parse_float(val_str):
    m = re.search(r"(\d+[\.,]\d+|\d+)", val_str)
    if m:
        return float(m.group(1).replace(",", "."))
    return None

def parse_spec_value(val_str):
    val_str_lower = val_str.lower()
    if "min" in val_str_lower:
        val = parse_float(val_str)
        if val is not None:
            return val, "min"
    elif "max" in val_str_lower:
        val = parse_float(val_str)
        if val is not None:
            return val, "max"
    return val_str.strip(), "text"

def get_product_id(product_dir):
    return re.sub(r'[^a-z0-9]+', '-', product_dir.lower()).strip('-')

def get_category(product_dir):
    name_lower = product_dir.lower()
    if any(k in name_lower for k in ["glycol", "glicol", "deg", "meg", "teg"]):
        return "Glycols"
    elif any(k in name_lower for k in ["alcohol", "alcool", "alcoholes", "ethanol", "methanol", "butanol", "propanol"]):
        return "Alcohols"
    elif any(k in name_lower for k in ["acetate", "acetato", "acrylate", "acrilato", "methacrylate", "ester"]):
        return "Esters"
    elif any(k in name_lower for k in ["acid", "ácido"]):
        return "Acids"
    elif any(k in name_lower for k in ["solvent", "solvente"]):
        return "Solvents"
    else:
        return "Others"

def clean_prop_name(name):
    return re.sub(r'\s+', ' ', name).strip()

def is_table_header(line_str):
    l = line_str.lower()
    l = l.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    l = re.sub(r'\s+', ' ', l)
    
    has_desc = "description" in l or "determin" in l or "property" in l or "parametro" in l or "caracteristica" in l or "unidades" in l or "metodo" in l
    has_spec = "specification" in l or "especific" in l or "limit" in l or "value" in l or "limite" in l or "valor" in l or "unidad" in l
    
    return has_desc and has_spec

def is_disclaimer(line_str):
    l = line_str.lower()
    l = l.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    l = re.sub(r'\s+', ' ', l)  # Normalize spaces
    
    disclaimer_keywords = [
        "relates only",
        "this information",
        "esta informacion",
        "esta informacio",
        "accura",
        "warranty",
        "liability",
        "no aceptamos",
        "responsabilidad",
        "garantia",
        "to the best of our",
        "compilacio",
        "loal saber",
        "leal saber",
        "particular use",
        "uso particular",
        "patent infringement",
        "infraccion de patente"
    ]
    return any(k in l for k in disclaimer_keywords)

def main():
    if not os.path.exists(ZIP_PATH):
        print(f"Error: ZIP file not found at {ZIP_PATH}")
        return
        
    z = zipfile.ZipFile(ZIP_PATH)
    
    product_dirs = sorted(list(set(
        name.split('/')[1] 
        for name in z.namelist() 
        if name.startswith("0 - Product Catalog/") and len(name.split('/')) > 1
    )))
    
    parsed_products = []
    
    for p_dir in product_dirs:
        spec_path = get_best_spec_file(z, p_dir)
        if not spec_path:
            continue
            
        try:
            pdf_data = z.open(spec_path)
            reader = pypdf.PdfReader(pdf_data)
            text = "".join(page.extract_text(extraction_mode="layout") for page in reader.pages)
            lines = text.split("\n")
            
            specs_started = False
            specs_list = []
            
            for line in lines:
                line_str = line.strip()
                if not line_str:
                    continue
                
                # Check for disclaimer to break
                if is_disclaimer(line_str):
                    break
                
                if not specs_started:
                    if is_table_header(line_str):
                        specs_started = True
                        continue
                else:
                    parts = re.split(r'\s{2,}', line_str)
                    if len(parts) >= 2:
                        raw_desc = clean_prop_name(parts[0])
                        if not raw_desc or raw_desc.lower() in ["description", "specification", "units", "determinacion", "especificacion", "unidad", "unidades", "metodo"]:
                            continue
                            
                        # If description is a header candidate or looks like disclaimer, skip/break
                        if is_disclaimer(raw_desc):
                            break
                            
                        if len(parts) >= 3:
                            unit = parts[1].strip()
                            spec_val_str = parts[2].strip()
                        else:
                            unit = ""
                            spec_val_str = parts[1].strip()
                            
                        val, limit_type = parse_spec_value(spec_val_str)
                        
                        # Normalize name case-insensitively
                        canonical_name = CANONICAL_MAP_LOWER.get(raw_desc.lower().strip(), raw_desc)
                        
                        # Set synonyms
                        synonyms = get_parameter_synonyms(canonical_name, raw_desc)

                        # Final deduplication of synonyms
                        seen = set()
                        deduped_synonyms = []
                        for s in synonyms:
                            if s and s not in seen:
                                seen.add(s)
                                deduped_synonyms.append(s)
                        synonyms = deduped_synonyms
                            
                        specs_list.append({
                            "id": f"{get_product_id(p_dir)}-{get_product_id(canonical_name)}",
                            "name": canonical_name,
                            "unit": unit or ("Visual" if limit_type == "text" else "%peso"),
                            "value": val,
                            "limitType": limit_type,
                            "synonyms": synonyms
                        })
            
            if specs_list:
                parsed_products.append({
                    "id": get_product_id(p_dir),
                    "name": p_dir,
                    "category": get_category(p_dir),
                    "specs": specs_list
                })
                
        except Exception as e:
            print(f"Error parsing {p_dir}: {e}")
            
    print(f"Successfully compiled {len(parsed_products)} products.")
    
    # Write TS file
    with open(OUTPUT_TS_PATH, "w", encoding="utf-8") as f:
        f.write("/* eslint-disable */\n")
        f.write("export interface SpecItem {\n")
        f.write("  id: string;\n")
        f.write("  name: string;\n")
        f.write("  unit: string;\n")
        f.write("  value: number | string;\n")
        f.write("  limitType: 'min' | 'max' | 'text';\n")
        f.write("  synonyms: string[];\n")
        f.write("  isOverride?: boolean;\n")
        f.write("  isExtra?: boolean;\n")
        f.write("}\n\n")
        
        f.write("export interface ClientSpecValue {\n")
        f.write("  specId: string;\n")
        f.write("  value: number | string;\n")
        f.write("  limitType: 'min' | 'max' | 'text';\n")
        f.write("}\n\n")
 
        f.write("export interface ClientSpec {\n")
        f.write("  customerId: string;\n")
        f.write("  customerName: string;\n")
        f.write("  specs: ClientSpecValue[];\n")
        f.write("}\n\n")
 
        f.write("export interface ProductSpec {\n")
        f.write("  id: string;\n")
        f.write("  name: string;\n")
        f.write("  category: string;\n")
        f.write("  specs: SpecItem[];\n")
        f.write("  clientSpecs?: ClientSpec[];\n")
        f.write("}\n\n")
        
        f.write("export const INITIAL_PRODUCTS: ProductSpec[] = ")
        f.write(json.dumps(parsed_products, indent=2, ensure_ascii=False))
        f.write(";\n")
        
    print(f"File {OUTPUT_TS_PATH} generated successfully.")

if __name__ == "__main__":
    main()
