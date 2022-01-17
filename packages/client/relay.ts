import { connect, createServer, Server, TcpSocketConnectOpts, Socket } from 'net'

export interface MinecraftRelayServerOptions {
  local: {
    port: number;
    hostname?: string
  }
  remote: TcpSocketConnectOpts
}

/**
 * The relay server for minecraft. This simply redirect packet to real server.
 * This is useful for create fake Minecraft lan server.
 */
 export interface MinecraftRelayServer {
  server: Server
  remote: Socket
}

export async function createMinecraftRelayServer(options: MinecraftRelayServerOptions): Promise<MinecraftRelayServer> {
  const server = createServer()
  const remote = connect(options.remote)

  server.on('connection', (socket) => {
    // outbound message
    socket.on('data', (buf) => {
      remote.write(buf)
    })
    // inbound message
    remote.on('data', (buf) => {
      socket.write(buf)
    })
  })

  server.listen(options.local.port, options.local.hostname)

  await Promise.all([new Promise((resolve, reject) => {
    // wait remote connection
    remote.once('ready', resolve)
    remote.once('error', reject)
  }), new Promise((resolve, reject) => {
    // wait server listen
    server.once('listening', resolve)
    server.once('error', reject)
  })])

  return {
    server,
    remote,
  }
}
