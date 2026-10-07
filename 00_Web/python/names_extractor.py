import os

# Ruta de la carpeta (cámbiala por la tuya)
carpeta = r"Season_8"

# Archivo de salida
output_file = "season_8.txt"

# Obtener lista de archivos
archivos = os.listdir(carpeta)

# Filtrar solo archivos (no carpetas)
archivos = [f for f in archivos if os.path.isfile(os.path.join(carpeta, f))]

# Escribir en el txt
with open(output_file, "w", encoding="utf-8") as f:
    for archivo in archivos:
        f.write(archivo + "\n")

print("Listo! Nombres guardados en:", output_file)