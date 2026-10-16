# Calma: reloj y clima

Página web con un reloj grande y el clima de tu ciudad sobre fondos relajantes (animaciones o videos). Los paneles tienen estilo *liquid glass*. Puedes elegir modo claro, oscuro o automático. Está pensada para dejarla en pantalla completa en una Smart TV, una tablet o un monitor.

## Qué incluye

- **Reloj** con fecha en español. Puede mostrarse en 24 h o 12 h, con o sin segundos. Muestra la hora de la ciudad elegida, aunque esté en otra zona horaria.
- **Clima actual**: temperatura, sensación térmica, máxima y mínima, humedad, viento, probabilidad de lluvia, índice UV, amanecer y atardecer. También el pronóstico de las próximas 8 horas y de 6 días. Se actualiza cada 15 minutos.
- **Ubicación automática**: se usa el GPS del navegador. Si no está disponible (lo normal en una TV), se usa una ubicación aproximada por IP. También puedes buscar cualquier ciudad a mano.
- **Fondos**:
  - 7 animaciones: Aurora, Océano, Cielo, Lluvia, Nieve, Noche estrellada y Luciérnagas. Cada una tiene versión de día y de noche.
  - 10 videos: olas, atardecer, lluvia, cascada, aurora boreal, estrellas, nieve, chimenea y nubes.
  - Modo **Automático**: elige el fondo según el clima y la hora.
- **Tema**: Claro, Oscuro o Automático. El automático cambia a oscuro al anochecer en tu ciudad.
- **Idioma**: español o inglés, en **Ajustes → Apariencia**. Se traduce toda la página, incluidos la fecha, el clima y el nombre de la ciudad detectada.
- **Pantalla completa** con un botón, sin barra de URL.
- **Modo Ahorro (Smart TV)**: reduce la resolución y la fluidez de las animaciones para que vayan suaves en TVs con poca potencia. Se activa solo cuando detecta una TV.
- Detalles para TV:
  - Los botones se ocultan tras 5 segundos sin uso.
  - El contenido se mueve unos píxeles cada 2 minutos para proteger pantallas OLED.
  - La pantalla se mantiene encendida si el navegador lo permite.

## Probarla en tu computadora

```bash
python3 -m http.server 8000
```

Abre <http://localhost:8000>. El GPS solo funciona en `localhost` o con `https://`.

## Publicarla gratis (para abrirla desde la TV)

1. Sube estos archivos a GitHub (`git add . && git commit -m "Calma" && git push`).
2. En el repositorio ve a **Settings → Pages**.
3. En **Source** elige **Deploy from a branch**, rama `main` y carpeta `/ (root)`. Guarda.
4. En uno o dos minutos estará en: **https://angelcoronaaa.github.io/time/**

## Usarla en la Smart TV

1. Abre el navegador de la TV (Samsung Internet, LG Web Browser, Chrome en Android TV o Google TV, etc.).
2. Escribe la dirección de GitHub Pages y guárdala en favoritos.
3. Con las flechas del control ve al botón de **pantalla completa** (⛶) y pulsa **OK**. Si tu TV no lo permite, usa la opción de pantalla completa del menú del navegador.
4. Si la ciudad no es la correcta, abre **Ajustes** (botón de la derecha) y búscala en **Ubicación**.

**Control remoto**

| Tecla | Acción |
| --- | --- |
| Flechas | Moverse entre botones |
| OK | Elegir |
| Atrás | Cerrar ajustes |
| Botón rojo | Siguiente fondo |
| Botón verde | Cambiar tema |
| Botón amarillo | Pantalla completa |
| Botón azul | Ajustes |

Los botones de colores funcionan solo en las TVs cuyo navegador los envía a la página.

**Teclado**

| Tecla | Acción |
| --- | --- |
| `F` | Pantalla completa |
| `T` | Cambiar tema |
| `L` | Cambiar idioma (español / inglés) |
| `B` | Siguiente fondo |
| `S` | Ajustes |
| `Esc` | Cerrar |

### Favoritos con tu configuración

Puedes guardar la configuración en la dirección, y así no tendrás que tocar los ajustes con el control:

```
https://angelcoronaaa.github.io/time/?bg=v-olas&theme=dark&forecast=false
```

| Parámetro | Valores |
| --- | --- |
| `lang` | `es`, `en` |
| `bg` | `auto`, `aurora`, `ocean`, `clouds`, `rain`, `snow`, `stars`, `fireflies`, `v-olas`, `v-atardecer`, `v-lluvia-hojas`, `v-lluvia-lago`, `v-cascada`, `v-aurora`, `v-estrellas`, `v-nieve`, `v-chimenea`, `v-nubes` |
| `theme` | `auto`, `light`, `dark` |
| `hour12` | `true`, `false` |
| `seconds` | `true`, `false` |
| `unit` | `c`, `f` |
| `forecast` | `true` (completo), `false` (solo reloj) |
| `quality` | `high`, `eco` |

## Sin barra de URL en celular o tablet

- **Android (Chrome)**: menú ⋮ → **Agregar a pantalla principal**.
- **iPhone o iPad (Safari)**: Compartir → **Agregar a inicio**.

Al abrirla desde ese ícono se ve en pantalla completa, como una app.

## Agregar tus propios videos

- **Desde Ajustes**: pega la URL de un `.mp4` en el campo de **Fondo → Videos**.
- **De forma permanente**: copia el archivo a una carpeta `videos/` y agrégalo a la lista `VIDEOS` al inicio de `js/app.js`:

  ```js
  { id: 'v-mio', name: { es: 'Mi video', en: 'My video' }, src: 'videos/mi-video.mp4', swatch: '#345' }
  ```

Para TV conviene usar videos en 720p o 1080p de pocos MB, que se puedan repetir en bucle.

## Estructura

```
index.html            Estructura de la página
css/styles.css        Estilos, liquid glass, temas claro y oscuro
js/scenes.js          Animaciones de fondo (canvas)
js/app.js             Reloj, clima, ubicación, ajustes, textos en español e inglés y control remoto
manifest.webmanifest  Instalación en pantalla completa
icons/                Íconos de la app
```

No usa frameworks ni compilación. El JavaScript es ES5 para que funcione en navegadores de TV antiguos.

## Créditos

- Datos del clima: [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0).
- Videos: [Mixkit](https://mixkit.co) (licencia gratuita).
- Ubicación: [BigDataCloud](https://www.bigdatacloud.com), [GeoJS](https://www.geojs.io) y [OpenStreetMap Nominatim](https://nominatim.org).
- Tipografía: [Inter](https://rsms.me/inter/).
