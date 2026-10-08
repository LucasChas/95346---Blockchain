# TP Clase 07: paso a paso con capturas

Cada 📸 es una captura que va al PDF, en el apartado que se indica entre corchetes.
Conviene sacar la captura con el comando **y** la salida visibles en la terminal.

**Antes de empezar**
- Windows: abrí **Ubuntu (WSL2)** y tené **Docker Desktop abierto**, con la integración WSL activada (Settings → Resources → WSL integration).
- Trabajá siempre dentro de `~/fabric-labs`. **No uses carpetas con espacios** (falla `deployCC`) ni `/mnt/c/...`.
- Usá **una sola terminal** del paso 4 en adelante: las funciones `usar_org` e `invocar` solo existen en la terminal donde las definiste.

---

## Paso 0: Verificar el entorno
```bash
docker --version
docker compose version
git --version
node --version
npm --version
```
📸 **Captura 1** [1. Entorno y versiones]

## Paso 1: Instalar Fabric 2.5.16
Si ya tenés `~/fabric-labs/fabric-samples` de la Clase 04, saltá este paso.
```bash
mkdir -p ~/fabric-labs && cd ~/fabric-labs
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
FABRIC_DOCKER_REGISTRY=docker.io/hyperledger ./install-fabric.sh --fabric-version 2.5.16 --ca-version 1.5.22 docker samples binary
```
Tarda unos minutos. Al final lista las imágenes `hyperledger/...`.
📸 **Captura 2 (opcional)**: el listado de imágenes al final [1. Entorno y versiones]

## Paso 2: Levantar la red con CouchDB
```bash
cd ~/fabric-labs/fabric-samples/test-network
./network.sh down
./network.sh up createChannel -c inventario -s couchdb
```
Tiene que terminar con `Channel 'inventario' joined`.
📸 **Captura 3**: las últimas líneas, con `Channel 'inventario' joined` [2. Red local con CouchDB]

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```
Tienen que aparecer `peer0.org1`, `peer0.org2`, `orderer`, `couchdb0` y `couchdb1`.
📸 **Captura 4** [2. Red local con CouchDB] ⭐ obligatoria

## Paso 3: Crear el chaincode a mano y compilar
Abrí **otra terminal** (dejá la de `test-network` como está):
```bash
mkdir -p ~/fabric-labs/inventario-ts/src
code ~/fabric-labs/inventario-ts
```
En VS Code creá estos 4 archivos con **New File** y pegá el contenido de la guía (o de la carpeta `inventario-ts/` de este repo):

| Archivo | Dónde |
|---|---|
| `package.json` | raíz |
| `tsconfig.json` | raíz |
| `index.ts` | dentro de `src/` |
| `inventario.ts` | dentro de `src/` |

📸 **Captura 5**: VS Code con el árbol de los 4 archivos y `inventario.ts` abierto [3. Chaincode]

```bash
cd ~/fabric-labs/inventario-ts
npm install
npm run build
test -f dist/index.js && echo "compilación OK"
```
📸 **Captura 6**: `> tsc` y `compilación OK` [3. Chaincode] ⭐

Volvé a la terminal de `test-network`.

## Paso 4: Desplegar
```bash
cd ~/fabric-labs/fabric-samples/test-network
CHAINCODE_PATH="$HOME/fabric-labs/inventario-ts"
./network.sh deployCC -c inventario -ccn inventario -ccp "$CHAINCODE_PATH" -ccl typescript -ccep "AND('Org1MSP.peer','Org2MSP.peer')"
```
La primera vez tarda 1 a 3 minutos, porque construye el contenedor del chaincode.
📸 **Captura 7**: `Committed chaincode definition ... Approvals: [Org1MSP: true, Org2MSP: true]` [4. Despliegue] ⭐

## Paso 5: Configurar las identidades
Pegá este bloque entero de una vez:
```bash
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/
export CORE_PEER_TLS_ENABLED=true
ORDERER_CA="${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"
ORG1_CA="${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
ORG2_CA="${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"

usar_org() {
  if [ "$1" = "1" ]; then
    export CORE_PEER_LOCALMSPID=Org1MSP
    export CORE_PEER_TLS_ROOTCERT_FILE=$ORG1_CA
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
    export CORE_PEER_ADDRESS=localhost:7051
    echo "Ahora sos Org1 (custodio)"
  else
    export CORE_PEER_LOCALMSPID=Org2MSP
    export CORE_PEER_TLS_ROOTCERT_FILE=$ORG2_CA
    export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
    export CORE_PEER_ADDRESS=localhost:9051
    echo "Ahora sos Org2 (autoridad)"
  fi
}

invocar() {
  peer chaincode invoke -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.example.com --tls --cafile "$ORDERER_CA" \
    -C inventario -n inventario \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$ORG1_CA" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "$ORG2_CA" \
    -c "$1"
}
```
Inicializá el ledger y consultá EQ-01:
```bash
clear
usar_org 1
invocar '{"function":"InitLedger","Args":[]}'
sleep 3
peer chaincode query -C inventario -n inventario -c '{"Args":["ReadEquipo","EQ-01"]}'
```
📸 **Captura 8**: `status:200` y EQ-01 `disponible` [5. Flujo] ⭐

## Paso 6: El flujo entre las dos organizaciones
Usá `clear` antes de cada bloque, así cada captura queda limpia.

**6.1: Org1 solicita**
```bash
clear
usar_org 1
invocar '{"function":"SolicitarPrestamo","Args":["EQ-01"]}'
sleep 3
peer chaincode query -C inventario -n inventario -c '{"Args":["ReadEquipo","EQ-01"]}'
```
📸 **Captura 9**: estado `solicitado` [5. Flujo] ⭐

**6.2: Org1 intenta actuar de nuevo (los dos errores)**
```bash
clear
usar_org 1
invocar '{"function":"SolicitarPrestamo","Args":["EQ-01"]}'
invocar '{"function":"AprobarPrestamo","Args":["EQ-01"]}'
```
📸 **Captura 10**: los dos `status:500`, uno por estado ("El turno es de Org2MSP") y otro por rol ("solo la autoridad...") [5. Flujo] ⭐⭐ la más importante

**6.3: Org2 aprueba**
```bash
clear
usar_org 2
invocar '{"function":"AprobarPrestamo","Args":["EQ-01"]}'
sleep 3
peer chaincode query -C inventario -n inventario -c '{"Args":["ReadEquipo","EQ-01"]}'
```
📸 **Captura 11**: `prestado` y `ultimaAccionPor: Org2MSP` [5. Flujo] ⭐

**6.4: Org2 registra la devolución**
```bash
clear
usar_org 2
invocar '{"function":"RegistrarDevolucion","Args":["EQ-01"]}'
sleep 3
peer chaincode query -C inventario -n inventario -c '{"Args":["ReadEquipo","EQ-01"]}'
```
📸 **Captura 12**: vuelve a `disponible` [5. Flujo] ⭐

## Paso 7: Rich query
```bash
clear
peer chaincode query -C inventario -n inventario -c '{"Args":["EquiposPorEstado","disponible"]}'
```
📸 **Captura 13**: los 3 equipos (ANTES) [6. Rich query] ⭐

```bash
clear
usar_org 1
invocar '{"function":"SolicitarPrestamo","Args":["EQ-01"]}'
sleep 3
peer chaincode query -C inventario -n inventario -c '{"Args":["EquiposPorEstado","disponible"]}'
```
📸 **Captura 14**: solo EQ-02 y EQ-03 (DESPUÉS) [6. Rich query] ⭐

Extra (suma puntos): abrí **http://localhost:5984/_utils** en el navegador, con usuario `admin` y clave `adminpw`. Es la interfaz de CouchDB (couchdb0). Entrá a la base `inventario_inventario` y abrí el documento EQ-01.
📸 **Captura 15 (opcional)**: el documento JSON en Fauxton [2. Red o 6. Rich query]

## Paso 8: Historial
```bash
clear
peer chaincode query -C inventario -n inventario -c '{"Args":["HistorialEquipo","EQ-01"]}'
```
La salida es larga. Si no entra en pantalla, achicá la letra (Ctrl y -) o sacá dos capturas.
📸 **Captura 16**: varias entradas con `txId` distintos y `ultimaAccionPor` [7. Historial] ⭐

## Paso 9: Limpiar
```bash
clear
cd ~/fabric-labs/fabric-samples/test-network
./network.sh down
docker ps --format "{{.Names}}" | grep -E "peer|orderer|couchdb|inventario" || echo "red detenida OK"
```
📸 **Captura 17**: `red detenida OK` [Limpieza] ⭐

---

## Si algo falla
| Síntoma | Causa | Solución |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop cerrado | Abrilo y esperá a que diga "running" |
| `Path to chaincode does not exist` | Ruta con espacios o mal escrita | Usá `$HOME/fabric-labs/inventario-ts` |
| `peer: command not found` o `usar_org: command not found` | Terminal nueva | Volvé a pegar el bloque del Paso 5 desde `test-network` |
| `el equipo EQ-01 no existe` | El commit todavía no se propagó | Esperá 2 o 3 segundos y repetí la consulta |
| Ves el estado anterior | Consultaste muy rápido | Repetí la consulta |
| `deployCC` falla tras un intento previo | Restos de la red anterior | `./network.sh down` y volvé al Paso 2 |

Anotá cualquier problema que te aparezca: va en el apartado "9. Problemas encontrados".
