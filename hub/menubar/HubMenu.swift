// Ultra Hub na barra de menu: mostra se o Hub está no ar, o que toca e atalhos.
// O servidor continua no launchd (com.ultratv.hub); este app só observa e controla.
import SwiftUI
import AppKit
import WebKit

@main
struct HubMenuApp: App {
    @StateObject private var hub = HubModel()

    var body: some Scene {
        MenuBarExtra {
            HubMenu(hub: hub)
        } label: {
            Image(systemName: hub.online ? "tv.inset.filled" : "tv.slash")
        }
        .menuBarExtraStyle(.window)
    }
}

struct Music: Decodable { let playing: Bool; let title: String?; let artist: String? }
struct Mac: Decodable { let cpu: Int; let ramUsed: Double; let ramTotal: Double }
struct State: Decodable { let music: Music?; let mac: Mac? }

@MainActor
final class HubModel: ObservableObject {
    static let home = FileManager.default.homeDirectoryForCurrentUser
    static let dir = URL(fileURLWithPath: Bundle.main.object(forInfoDictionaryKey: "HubDir") as? String ?? "")
    let base = URL(string: "http://127.0.0.1:3020")!

    @Published var online = false
    @Published var state: State?
    @Published var ip = ""

    init() {
        refresh()
        Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { [weak self] _ in Task { @MainActor in self?.refresh() } }
    }

    func refresh() {
        ip = Self.localIP() ?? "?"
        Task {
            do {
                let (data, _) = try await URLSession.shared.data(from: base.appendingPathComponent("api/tv/state"))
                state = try JSONDecoder().decode(State.self, from: data)
                online = true
            } catch {
                online = false
                state = nil
            }
        }
    }

    var phoneURL: String { "http://\(ip):3020" }

    func launchctl(_ args: [String]) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        p.arguments = args
        try? p.run()
        p.waitUntilExit()
    }

    var plist: String { Self.home.appendingPathComponent("Library/LaunchAgents/com.ultratv.hub.plist").path }
    var target: String { "gui/\(getuid())/com.ultratv.hub" }

    func restart() { launchctl(["kickstart", "-k", target]); after() }
    func stop() { launchctl(["bootout", target]); after() }
    func start() { launchctl(["bootstrap", "gui/\(getuid())", plist]); after() }
    private func after() { DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { self.refresh() } }

    func open(_ s: String) { if let u = URL(string: s) { NSWorkspace.shared.open(u) } }
    func reveal(_ path: String) { NSWorkspace.shared.open(Self.home.appendingPathComponent(path)) }

    func copy(_ s: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(s, forType: .string)
    }

    // The Mac's Wi-Fi/Ethernet address on the LAN (what the TV and the phone use).
    static func localIP() -> String? {
        var addr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&addr) == 0, let first = addr else { return nil }
        defer { freeifaddrs(addr) }
        var found: String?
        for p in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let a = p.pointee
            guard a.ifa_addr.pointee.sa_family == UInt8(AF_INET) else { continue }
            let name = String(cString: a.ifa_name)
            guard name.hasPrefix("en") else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            getnameinfo(a.ifa_addr, socklen_t(a.ifa_addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
            let ip = String(cString: host)
            if ip.hasPrefix("192.168.") || ip.hasPrefix("10.") { found = ip; if name == "en0" { break } }
        }
        return found
    }
}

struct HubMenu: View {
    @ObservedObject var hub: HubModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Circle().fill(hub.online ? Color.green : Color.red).frame(width: 9, height: 9)
                Text("Ultra Hub").font(.headline)
                Spacer()
                Text(hub.online ? "no ar" : "parado").foregroundStyle(.secondary).font(.caption)
            }

            if let m = hub.state?.music, m.playing {
                Label("\(m.title ?? "") — \(m.artist ?? "")", systemImage: "music.note")
                    .lineLimit(1).font(.callout)
            }
            if let mac = hub.state?.mac {
                Text("Mac: CPU \(mac.cpu)%  ·  RAM \(String(format: "%.1f", mac.ramUsed)) / \(Int(mac.ramTotal)) GB")
                    .font(.caption).foregroundStyle(.secondary)
            }

            if hub.online {
                // The phone page itself: remote, typing, reminders, send to TV, music.
                HubPage(url: hub.base).frame(height: 460).clipShape(RoundedRectangle(cornerRadius: 12))
            }

            Divider()
            Button { hub.open(hub.phoneURL) } label: { Label("Abrir no navegador (\(hub.phoneURL))", systemImage: "safari") }
            Button { hub.copy(hub.phoneURL) } label: { Label("Copiar link pro celular", systemImage: "doc.on.doc") }
            Button { hub.open("http://127.0.0.1:3020/spotify/login") } label: { Label("Reconectar Spotify", systemImage: "music.quarternote.3") }

            Divider()
            Button { hub.reveal("Pictures/Referencias") } label: { Label("Pasta de referências", systemImage: "photo.on.rectangle") }
            Button { hub.reveal("Movies/TV") } label: { Label("Pasta de vídeos pra TV", systemImage: "film") }
            Button { NSWorkspace.shared.open(HubModel.dir.appendingPathComponent("hub.log")) } label: { Label("Ver log", systemImage: "doc.text") }

            Divider()
            HStack {
                if hub.online {
                    Button("Reiniciar") { hub.restart() }
                    Button("Parar") { hub.stop() }
                } else {
                    Button("Iniciar") { hub.start() }
                }
                Spacer()
                Button("Sair") { NSApp.terminate(nil) }
            }
        }
        .buttonStyle(.borderless)
        .padding(14)
        .frame(width: 380)
    }
}

struct HubPage: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        let web = WKWebView()
        web.setValue(false, forKey: "drawsBackground")
        web.load(URLRequest(url: url))
        return web
    }

    func updateNSView(_ web: WKWebView, context: Context) {
        if web.url == nil { web.load(URLRequest(url: url)) }
    }
}
