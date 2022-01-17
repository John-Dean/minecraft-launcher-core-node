import { Socket, createSocket, RemoteInfo } from "dgram"
import { EventEmitter } from "events"

export const LAN_MULTICAST_ADDR = "224.0.2.60"
export const LAN_MULTICAST_PORT = 4445

export interface MinecraftLanDiscover {
    on(channel: "discover", listener: (event: LanServerInfo & { remote: RemoteInfo }) => void): this
    once(channel: "discover", listener: (event: LanServerInfo & { remote: RemoteInfo }) => void): this
    addListener(channel: "discover", listener: (event: LanServerInfo & { remote: RemoteInfo }) => void): this
    removeListener(channel: "discover", listener: (event: LanServerInfo & { remote: RemoteInfo }) => void): this
}

export class MinecraftLanDiscover extends EventEmitter {

    constructor(readonly socket = createSocket({ type: "udp4", reuseAddr: true })) {
        super()
        socket.on("listening", () => {
            const address = socket.address()
            socket.addMembership(LAN_MULTICAST_ADDR, address.address)
            socket.setMulticastTTL(128);
            socket.setBroadcast(true)
        })


        socket.on("message", (buf, remote) => {
            const content = buf.toString("utf-8")

            const motdRegx = /\[MOTD\](.+)\[\/MOTD\]/g
            const portRegx = /\[AD\](.+)\[\/AD\]/g

            const portResult = portRegx.exec(content)
            if (!portResult || !portResult[1]) {
                // emit error
            } else {
                const motd = motdRegx.exec(content)?.[1] ?? ""
                const port = Number.parseInt(portResult[1])
                this.emit("discover", { motd, port, remote })
            }
        })
    }

    bind(): Promise<void> {
        return new Promise((resolve) => {
            this.socket.bind(LAN_MULTICAST_PORT, "192.168.2.244", () => {
                resolve()
            })
        })
    }

    destroy(): Promise<void> {
        return new Promise((resolve) => {
            this.socket.close(resolve)
        })
    }
}

export interface LanServerInfo {
    motd: string
    port: number
}

export class MinecraftLanBroadcaster {
    private intervalHandle: NodeJS.Timeout | undefined

    constructor(
        readonly socket =  createSocket({ type: "udp4", reuseAddr: true }),
        readonly servers: LanServerInfo[] = [],
        readonly interval: number,
    ) {
        socket.addMembership(LAN_MULTICAST_ADDR)
        socket.setMulticastTTL(120)
        this.intervalHandle = setInterval(() => this.broadcast())
    }

    broadcast() {
        for (const inf of this.servers) {
            this.socket.send(`[MOTD]${inf.motd}[/MOTD][AD]${inf.port}[/AD]`, LAN_MULTICAST_PORT, LAN_MULTICAST_ADDR, (err, bytes) => {
                // todo handle this
            })
        }
    }

    bind() {
        this.socket.bind();
    }

    destroy() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle)
        }
        return new Promise<void>((resolve) => {
            this.socket.close(resolve)
        })
    }
}
