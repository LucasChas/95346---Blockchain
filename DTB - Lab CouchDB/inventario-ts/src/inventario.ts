import { Context, Contract } from 'fabric-contract-api';

// El activo Equipo modela un préstamo entre dos organizaciones.
// Estados posibles y quién puede moverlos:
//
//   disponible  --SolicitarPrestamo (Org1, custodio)-->  solicitado
//   solicitado  --AprobarPrestamo   (Org2, autoridad)-->  prestado
//   solicitado  --RechazarPrestamo  (Org2, autoridad)-->  disponible
//   prestado    --RegistrarDevolucion (Org2, autoridad)-> disponible
//
// Regla de rol: cada operación exige un MSP concreto Y un estado de origen concreto.
// Cuando Org1 solicita, el estado pasa a "solicitado" y el turno es de Org2:
// Org1 no puede volver a actuar sobre ese equipo hasta que Org2 resuelva.
interface Equipo {
    docType: string;
    id: string;
    descripcion: string;
    custodio: string;       // organización dueña del equipo (rol Org1 en el flujo)
    solicitante: string;    // organización que pidió el préstamo
    estado: string;         // disponible | solicitado | prestado
    ultimaActualizacion: string;
    ultimaAccionPor: string; // MSP de quien hizo el último cambio
}

const ORG1 = 'Org1MSP'; // custodio: solicita
const ORG2 = 'Org2MSP'; // autoridad: aprueba, rechaza, registra devolución

export class InventarioContract extends Contract {

    // Timestamp determinista: mismo valor en todos los peers endosantes.
    private txTime(ctx: Context): string {
        const ts = ctx.stub.getTxTimestamp();
        const millis = ts.seconds.toInt() * 1000 + Math.floor(ts.nanos / 1e6);
        return new Date(millis).toISOString();
    }

    private async leer(ctx: Context, id: string): Promise<Equipo> {
        const data = await ctx.stub.getState(id);
        if (!data || data.length === 0) throw new Error(`el equipo ${id} no existe`);
        return JSON.parse(data.toString()) as Equipo;
    }

    private async guardar(ctx: Context, equipo: Equipo): Promise<void> {
        equipo.ultimaActualizacion = this.txTime(ctx);
        equipo.ultimaAccionPor = ctx.clientIdentity.getMSPID();
        await ctx.stub.putState(equipo.id, Buffer.from(JSON.stringify(equipo)));
    }

    async InitLedger(ctx: Context): Promise<void> {
        const equipos: Equipo[] = [
            { docType: 'equipo', id: 'EQ-01', descripcion: 'Servidor de pruebas', custodio: 'Org1', solicitante: '', estado: 'disponible', ultimaActualizacion: this.txTime(ctx), ultimaAccionPor: ORG1 },
            { docType: 'equipo', id: 'EQ-02', descripcion: 'Osciloscopio', custodio: 'Org1', solicitante: '', estado: 'disponible', ultimaActualizacion: this.txTime(ctx), ultimaAccionPor: ORG1 },
            { docType: 'equipo', id: 'EQ-03', descripcion: 'Impresora 3D', custodio: 'Org1', solicitante: '', estado: 'disponible', ultimaActualizacion: this.txTime(ctx), ultimaAccionPor: ORG1 },
        ];
        for (const equipo of equipos) {
            await ctx.stub.putState(equipo.id, Buffer.from(JSON.stringify(equipo)));
        }
    }

    async ReadEquipo(ctx: Context, id: string): Promise<Equipo> {
        return this.leer(ctx, id);
    }

    // PASO 1 — Org1 (custodio) solicita el préstamo del equipo a Org2.
    // Requiere estado "disponible". Deja el equipo en "solicitado": ahora el turno es de Org2.
    async SolicitarPrestamo(ctx: Context, id: string): Promise<void> {
        const equipo = await this.leer(ctx, id);
        const clienteMSP = ctx.clientIdentity.getMSPID();

        // Control por rol: solo el custodio (Org1) puede solicitar.
        if (clienteMSP !== ORG1) {
            throw new Error(`solo el custodio (${ORG1}) puede solicitar el préstamo; cliente recibido: ${clienteMSP}`);
        }
        // Control por estado: solo se solicita algo disponible.
        // Si el estado ya es "solicitado", Org1 no puede volver a solicitar: el turno es de Org2.
        if (equipo.estado !== 'disponible') {
            throw new Error(`no se puede solicitar ${id}: estado actual "${equipo.estado}". El turno es de ${ORG2}`);
        }

        equipo.estado = 'solicitado';
        equipo.solicitante = 'Org2';
        await this.guardar(ctx, equipo);
    }

    // PASO 2a — Org2 (autoridad) aprueba la solicitud. Requiere estado "solicitado".
    async AprobarPrestamo(ctx: Context, id: string): Promise<void> {
        const equipo = await this.leer(ctx, id);
        const clienteMSP = ctx.clientIdentity.getMSPID();

        // Control por rol: solo la autoridad (Org2) aprueba. Org1 no puede aprobar su propia solicitud.
        if (clienteMSP !== ORG2) {
            throw new Error(`solo la autoridad (${ORG2}) puede aprobar; cliente recibido: ${clienteMSP}`);
        }
        // Control por estado: solo se aprueba algo solicitado.
        if (equipo.estado !== 'solicitado') {
            throw new Error(`no se puede aprobar ${id}: estado actual "${equipo.estado}". Se esperaba "solicitado"`);
        }

        equipo.estado = 'prestado';
        await this.guardar(ctx, equipo);
    }

    // PASO 2b — Org2 (autoridad) rechaza la solicitud. Vuelve a "disponible".
    async RechazarPrestamo(ctx: Context, id: string): Promise<void> {
        const equipo = await this.leer(ctx, id);
        const clienteMSP = ctx.clientIdentity.getMSPID();

        if (clienteMSP !== ORG2) {
            throw new Error(`solo la autoridad (${ORG2}) puede rechazar; cliente recibido: ${clienteMSP}`);
        }
        if (equipo.estado !== 'solicitado') {
            throw new Error(`no se puede rechazar ${id}: estado actual "${equipo.estado}". Se esperaba "solicitado"`);
        }

        equipo.estado = 'disponible';
        equipo.solicitante = '';
        await this.guardar(ctx, equipo);
    }

    // PASO 3 — Org2 (autoridad) registra la devolución. De "prestado" a "disponible".
    async RegistrarDevolucion(ctx: Context, id: string): Promise<void> {
        const equipo = await this.leer(ctx, id);
        const clienteMSP = ctx.clientIdentity.getMSPID();

        if (clienteMSP !== ORG2) {
            throw new Error(`solo la autoridad (${ORG2}) puede registrar la devolución; cliente recibido: ${clienteMSP}`);
        }
        if (equipo.estado !== 'prestado') {
            throw new Error(`no se puede devolver ${id}: estado actual "${equipo.estado}". Se esperaba "prestado"`);
        }

        equipo.estado = 'disponible';
        equipo.solicitante = '';
        await this.guardar(ctx, equipo);
    }

    // Rich query: solo funciona con CouchDB. Busca equipos por estado.
    async EquiposPorEstado(ctx: Context, estado: string): Promise<Equipo[]> {
        const query = {
            selector: { docType: 'equipo', estado },
        };
        const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
        const equipos: Equipo[] = [];
        let result = await iterator.next();
        while (!result.done) {
            equipos.push(JSON.parse(result.value.value.toString()) as Equipo);
            result = await iterator.next();
        }
        await iterator.close();
        return equipos;
    }

    // Historial: recorre el transaction log de una clave.
    async HistorialEquipo(ctx: Context, id: string): Promise<object[]> {
        const iterator = await ctx.stub.getHistoryForKey(id);
        const historia: object[] = [];
        let result = await iterator.next();
        while (!result.done) {
            historia.push({
                txId: result.value.txId,
                isDelete: result.value.isDelete,
                value: result.value.value.toString(),
            });
            result = await iterator.next();
        }
        await iterator.close();
        return historia;
    }
}
