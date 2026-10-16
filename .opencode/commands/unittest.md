---
description: Crea tests unitarios de una clase detectando su lenguaje y usando la librería de testing más común (JUnit en Java/Kotlin, pytest en Python, Jest en JS, etc.).
---

Crea la suite de tests unitarios para el objetivo que se pasa en los argumentos: `$ARGUMENTS`.
El argumento puede ser un **nombre de clase**, una **ruta de archivo** o un **directorio**.
Si no se pasa nada, pregunta cuál clase/fichero se quiere testear.

Sigue estos pasos en orden y no saltes la detección de lenguaje:

## 1. Resolver el objetivo
- Si `$ARGUMENTS` es una ruta de archivo que existe, úsala como fichero fuente.
- Si es un nombre de clase/fichero (p. ej. `FooService`), **busca** el fichero fuente
  correspondiente con `Glob`/`Grep` (prueba las extensiones habituales del lenguaje y los
  sufijos `*Test*`/`*Tests*` para excluir tests ya existentes).
- Si hay varios candidatos, elige el que mejor coincida y **anota** cuál elegiste; si la
  decisión es ambigua, pregúntalo.
- Identifica las **dependencias** del objetivo (otras clases, servicios, I/O, red, base de datos,
  tiempo, aleatoriedad): esas se **faken/mockean** en el test.

## 2. Detectar el lenguaje de programación
Decídilo por estas pistas, en este orden:
1. **Extension del fichero** (`.java` `.kt` `.js` `.ts` `.py` `.cs` `.swift` `.go` `.rs` `.php`
   `.rb` `.cc/.cpp` `.c` …).
2. **Ficheros de proyecto/build** del mismo árbol: `pom.xml`/`build.gradle(.kts)` → Java/Kotlin;
   `package.json` → JS/TS; `pyproject.toml`/`setup.py`/`requirements.txt` → Python;
   `Cargo.toml` → Rust; `go.mod` → Go; `*.csproj` → C#; `Gemfile`/`*.gemspec` → Ruby;
   `CMakeLists.txt` → C/C++; `*.xcodeproj` → Swift.
3. **Convenciones de directorio** (p. ej. `src/main/java/...` → Java; `src/test/` → JUnit).

Anuncia brevemente el lenguaje detectado y la evidencia (extensión + fichero de proyecto).

## 3. Elegir la librería de testing
**Preferencia: la que YA use el proyecto.** Si el proyecto ya declara un framework de testing en
su build/manifest (`pom.xml`, `build.gradle`, `package.json`, `pyproject.toml`, `Cargo.toml`,
`go.mod`, …), **reúsalo** tal cual. Si no hay ninguno, usa la **más común** del lenguaje
("Junit si es posible"). Mapa de referencia:

| Lenguaje       | Preferida (lo más común)                | Fallback / alternativa |
|----------------|-----------------------------------------|------------------------|
| Java           | **JUnit 5 (Jupiter)** `org.junit.jupiter` | JUnit 4 si el proyecto la usa ya |
| Kotlin         | **JUnit 5** / Kotest / kotlin.test      | kotlin.test si es KMP/mobile |
| JS / TS        | **Jest** (o Vitest)                     | `node:test` nativo si no hay `package.json` |
| Python         | **pytest**                              | `unittest` (estándar)  |
| C#             | **xUnit**                               | NUnit / MSTest         |
| Swift          | **XCTest**                              | Swift Testing (`@Test`)|
| Go             | **`testing` estándar** (`go test`)      | —                      |
| Rust           | **`#[cfg(test)]` + `cargo test`**       | `quickcheck`           |
| PHP            | **PHPUnit**                             | PHPUnit                |
| Ruby           | **RSpec**                               | minitest               |
| C++            | **Google Test**                         | Catch2                 |
| C              | **Unity**                               | CMocka                 |

Si el framework elegido **no está instalado** en el proyecto, indícalo y, si es viable sin
romper nada, añade la dependencia al fichero de build (`<dependency>`, `dependencies{}`,
`devDependencies`, etc.) y/o la instrucción para instalarlo. No inventes versiones: usa la que
ya aparece en el proyecto o la línea de comandos habitual.

## 4. Ubicación y nombre del test
Sigue la **convención del framework**, no inventes rutas:
- **JUnit/Java/Kotlin**: el test va en la fuente de tests (`src/test/java`, `src/test/kotlin`),
  **mismo package** que la clase y nombre `ClaseTest`.
- **Jest/Vitest**: normalmente junto al código o en `__tests__/`, nombre `clase.test.js`
  (o `.spec.js`). **pytest**: `test_clase.py`, a veces en `tests/`.
- **Go**: `clase_test.go` en el **mismo paquete/directorio**. **Rust**: `mod tests` o
  `tests/`. **XCTest**: dentro del target de test de Xcode.
- Si el proyecto ya tiene un directorio de tests, **respétalo** y colócalo ahí.

## 5. Escribir los tests
- Cubre los **métodos/funciones públicos**: caso feliz, **casos límite** (vacío, nulo, 0, 1,
  máximos, entradas al borde) y **casos de error/exception** (usa `assertThrows`/`pytest.raises`/
  `expect().rejects` según el framework).
- **Isola dependencias** con mocks/stubs/fakes (Mockito en JUnit, `unittest.mock`/`pytest` en
  Python, `jest.mock`/`vi.mock` en JS, `t.Setenv`/interfaces en Go, etc.). No toques la red, el
  sistema de ficheros ni la base de datos reales.
- Nombres de test **legibles** (p. ej. `should_..._when_...` o el idiom del framework).
- Un **assert claro** por caso; evita tests que pasen de más y evita copiar-comentar el código.
- **Respeta el estilo del proyecto**: misma convención de nombres, imports y formato que los otros
  tests existentes (si los hay, lee uno de ejemplo antes de escribir).
- **Idioma**: comentarios y textos de usuario en **español**, como el resto del proyecto.

## 6. Verificar
- Si el proyecto **tiene** el framework y puede correr los tests, **ejecútalos** con la línea
  habitual (`./gradlew test`, `mvn test`, `npm test`, `pytest`, `go test ./...`, `cargo test`, …)
  y **arregla** los fallos hasta que pasen o, si no se pueden pasar, explica por qué.
- Si el proyecto **no tiene** framework instalado (p. ej. el prototipo JS de este repo, que no
  trae `package.json` ni tests), **no fuerces** una instalación: indica claramente qué falta
  (fichero de build + dependencia + comando) y entrega el test listo para ejecutarse en cuanto
  se añada, eligiendo la opción de **cero configuración** si el lenguaje la tiene (`node:test`).
- **No rompas** ficheros existentes: solo crea/añade el test y (si procede) la dependencia.

## 7. Reporta
Responde breve: lenguaje detectado, framework elegido (y por qué), ruta del test creado, qué
métodos/casos cubre y cómo ejecutarlos. Si tuviste que asumir algo (clase elegida entre varias,
dependencia añadida), diéjalo explícito.
