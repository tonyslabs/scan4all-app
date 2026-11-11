# scan4All App

Aplicación móvil desarrollada con **React Native + Expo**, que permite analizar **archivos y URLs** mediante la API pública de **VirusTotal**.

La app actúa como cliente visual para el backend `scan4all-api`, mostrando el estado, resultado y estadísticas de seguridad de cada análisis.

---

## Descripción general

**Scan4All** permite:

- Subir cualquier tipo de archivo (PDF, JPG, EXE, ZIP, etc.)
- Analizar URLs sospechosas o enlaces web
- Ver el progreso del análisis en tiempo real
- Mostrar un resumen visual del resultado (seguro, malicioso o no soportado)
- Revisar los motores antivirus que participaron y sus respuestas

---

## Tecnologías

| Área | Tecnología |
|------|-------------|
| Core | React Native (Expo SDK 52) |
| Lenguaje | TypeScript |
| Navegación | React Navigation (Native Stack) |
| UI | Ionicons, React Native Stylesheet |
| Backend | FastAPI (API local) |
| API externa | VirusTotal API v3 |
| Build | Expo EAS CLI |

---

## Requisitos previos

- Node.js 20+
- PNPM 9+
- Expo CLI (`pnpm add -g expo-cli`)
- Backend corriendo localmente (`scan4all-api` en el puerto 8000)
- Android Studio o dispositivo físico con Expo Go

---

## Instalación y levantamiento

```bash
# Clonar el repositorio
git clone https://github.com/tuusuario/scan4all-app.git
cd scan4all-app

# Instalar dependencias
pnpm install

# Iniciar en modo desarrollo
pnpm start
