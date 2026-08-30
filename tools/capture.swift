import AppKit
import Darwin
import Foundation
import WebKit

private struct CaptureArguments {
    let route: String
    let viewportWidth: CGFloat
    let viewportHeight: CGFloat
    let outputURL: URL
    let state: String

    init?() {
        let arguments = CommandLine.arguments
        guard arguments.count == 5 || arguments.count == 6,
              arguments[1].hasPrefix("/"),
              let width = Double(arguments[2]),
              let height = Double(arguments[3]),
              width.isFinite,
              height.isFinite,
              width > 0,
              height > 0 else {
            Self.printUsage()
            return nil
        }

        let state = arguments.count == 6 ? arguments[5] : "default"
        let supportedStates = [
            "default", "menu-open", "menu-route", "skip-link",
            "cookie-accept", "review-controls", "tyre-manual", "popstate", "menu-resize",
            "tyrescope-configured", "tyrescope-error", "enquiry-details",
        ]
        guard supportedStates.contains(state) else {
            Self.printUsage()
            return nil
        }

        route = arguments[1]
        viewportWidth = CGFloat(width)
        viewportHeight = CGFloat(height)
        outputURL = URL(fileURLWithPath: arguments[4]).standardizedFileURL
        self.state = state
    }

    private static func printUsage() {
        let usage = "Usage: capture.swift <route> <width> <height> <output.png> [default|menu-open|menu-route|skip-link|cookie-accept|review-controls|tyre-manual|popstate|menu-resize|tyrescope-configured|tyrescope-error|enquiry-details]\n"
        FileHandle.standardError.write(Data(usage.utf8))
    }
}

private enum CaptureError: LocalizedError {
    case missingFile(String)
    case missingTag(String)
    case invalidDocument
    case javascriptAudit
    case pngEncoding

    var errorDescription: String? {
        switch self {
        case .missingFile(let path):
            return "Required source file is missing: \(path)"
        case .missingTag(let tag):
            return "Could not find \(tag) in index.html"
        case .invalidDocument:
            return "WebKit did not provide a renderable document view"
        case .javascriptAudit:
            return "The page audit did not return JSON"
        case .pngEncoding:
            return "The full-page bitmap could not be encoded as PNG"
        }
    }
}

private func fail(_ message: String, status: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data("site-capture: \(message)\n".utf8))
    fflush(stdout)
    fflush(stderr)
    exit(status)
}

private func source(at url: URL) throws -> String {
    guard FileManager.default.fileExists(atPath: url.path) else {
        throw CaptureError.missingFile(url.path)
    }
    return try String(contentsOf: url, encoding: .utf8)
}

private func mimeType(for url: URL) -> String {
    switch url.pathExtension.lowercased() {
    case "svg": return "image/svg+xml"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "webp": return "image/webp"
    case "gif": return "image/gif"
    case "avif": return "image/avif"
    case "ico": return "image/x-icon"
    case "woff": return "font/woff"
    case "woff2": return "font/woff2"
    default: return "application/octet-stream"
    }
}

/// Replaces local `assets/...` references with data URLs. This keeps the fake
/// HTTP route useful for SPA routing while still loading repository assets.
private func inliningLocalAssets(in source: String, siteRoot: URL) -> String {
    let pattern = #"(?:\.\./|\./|/)?assets/[A-Za-z0-9._~%/-]+"#
    guard let expression = try? NSRegularExpression(pattern: pattern) else {
        return source
    }

    let sourceString = source as NSString
    let result = NSMutableString(string: source)
    let matches = expression.matches(
        in: source,
        range: NSRange(location: 0, length: sourceString.length)
    )

    for match in matches.reversed() {
        let reference = sourceString.substring(with: match.range)
        guard let assetsRange = reference.range(of: "assets/") else { continue }
        let relativePath = String(reference[assetsRange.lowerBound...])
            .removingPercentEncoding ?? String(reference[assetsRange.lowerBound...])
        let fileURL = siteRoot.appendingPathComponent(relativePath).standardizedFileURL
        let rootPrefix = siteRoot.standardizedFileURL.path + "/"

        guard fileURL.path.hasPrefix(rootPrefix),
              let data = try? Data(contentsOf: fileURL) else {
            continue
        }

        let dataURL = "data:\(mimeType(for: fileURL));base64,\(data.base64EncodedString())"
        result.replaceCharacters(in: match.range, with: dataURL)
    }

    return result as String
}

private func replacingMatches(
    in source: String,
    pattern: String,
    with replacement: String,
    requiredTag: String? = nil
) throws -> String {
    let expression = try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
    let range = NSRange(source.startIndex..., in: source)
    guard expression.firstMatch(in: source, range: range) != nil else {
        if let requiredTag {
            throw CaptureError.missingTag(requiredTag)
        }
        return source
    }

    return expression.stringByReplacingMatches(
        in: source,
        range: range,
        withTemplate: NSRegularExpression.escapedTemplate(for: replacement)
    )
}

private func knownRoutes(from serverSource: String) -> [String] {
    guard let expression = try? NSRegularExpression(pattern: #"[\"'](/[^\"']*)[\"']"#) else {
        return []
    }

    let sourceString = serverSource as NSString
    let matches = expression.matches(
        in: serverSource,
        range: NSRange(location: 0, length: sourceString.length)
    )
    let routes = matches.compactMap { match -> String? in
        let value = sourceString.substring(with: match.range(at: 1))
        guard value == "/" || (!value.contains(".") && !value.contains("?")) else {
            return nil
        }
        return value.count > 1 ? value.replacingOccurrences(of: #"/+$"#, with: "", options: .regularExpression) : value
    }
    return Array(Set(routes)).sorted()
}

private func preparedDocument(siteRoot: URL, state: String) throws -> String {
    var html = try source(at: siteRoot.appendingPathComponent("index.html"))
    var css = try source(at: siteRoot.appendingPathComponent("styles.css"))
    var appJavaScript = try source(at: siteRoot.appendingPathComponent("config.js"))
        + "\n"
        + source(at: siteRoot.appendingPathComponent("site-utils.js"))
        + "\n"
        + source(at: siteRoot.appendingPathComponent("tyre-api.js"))
        + "\n"
        + source(at: siteRoot.appendingPathComponent("tyre-enquiry.js"))
        + "\n"
        + source(at: siteRoot.appendingPathComponent("tyrescope-embed.js"))
        + "\n"
        + source(at: siteRoot.appendingPathComponent("app.js"))
    if state == "tyrescope-configured" || state == "tyrescope-error" {
        appJavaScript = appJavaScript.replacingOccurrences(
            of: "tyrescopeEmbedUrl: \"\"",
            with: "tyrescopeEmbedUrl: \"https://tyrescope.test/embed\""
        )
    }
    let serverSource = try source(at: siteRoot.appendingPathComponent("server.py"))

    css = css.replacingOccurrences(
        of: #"@import\s+url\([^;]*https?://[^;]+;"#,
        with: "",
        options: [.regularExpression, .caseInsensitive]
    )
    html = inliningLocalAssets(in: html, siteRoot: siteRoot)
    css = inliningLocalAssets(in: css, siteRoot: siteRoot)
    appJavaScript = inliningLocalAssets(in: appJavaScript, siteRoot: siteRoot)

    let routesJSON = String(
        data: try JSONEncoder().encode(knownRoutes(from: serverSource)),
        encoding: .utf8
    ) ?? "[]"
    var appLiteral = String(
        data: try JSONEncoder().encode(appJavaScript),
        encoding: .utf8
    ) ?? "\"\""
    appLiteral = appLiteral.replacingOccurrences(of: "</", with: "<\\/")

    let instrumentation = """
    <script>
    window.__captureConsole = [];
    window.__captureKnownRoutes = \(routesJSON);
    (function () {
      ['error', 'warn'].forEach(function (level) {
        var original = console[level];
        console[level] = function () {
          window.__captureConsole.push(level + ': ' + Array.prototype.join.call(arguments, ' '));
          if (original) return original.apply(console, arguments);
        };
      });
      window.onerror = function (message, source, line, column, error) {
        window.__captureConsole.push(
          'uncaught: ' + message + ' @ ' + source + ':' + line + ':' + column + ' ' +
          (error && error.stack || '')
        );
      };
      window.addEventListener('unhandledrejection', function (event) {
        window.__captureConsole.push('unhandledrejection: ' + String(event.reason));
      });
    })();
    </script>
    """
    let runner = """
    <script>
    try {
      (0, eval)(\(appLiteral));
    } catch (error) {
      window.__captureConsole.push(
        'fatal: ' + error.name + ': ' + error.message + ' ' + (error.stack || '')
      );
    }
    </script>
    """

    html = try replacingMatches(
        in: html,
        pattern: #"<link[^>]+rel=[\"']preconnect[\"'][^>]*>"#,
        with: ""
    )
    html = try replacingMatches(
        in: html,
        pattern: #"<link[^>]+href=[\"']/styles\.css[\"'][^>]*>"#,
        with: "<style>\(css)</style>",
        requiredTag: "the /styles.css link"
    )
    html = try replacingMatches(
        in: html,
        pattern: #"<script[^>]+src=[\"']/config\.js[\"'][^>]*></script>"#,
        with: ""
    )
    html = try replacingMatches(
        in: html,
        pattern: #"<script[^>]+src=[\"']/site-utils\.js[\"'][^>]*></script>"#,
        with: "",
        requiredTag: "the /site-utils.js script"
    )
    html = try replacingMatches(
        in: html,
        pattern: #"<script[^>]+src=[\"']/tyre-api\.js[\"'][^>]*></script>"#,
        with: "",
        requiredTag: "the /tyre-api.js script"
    )
    html = try replacingMatches(
        in: html,
        pattern: #"<script[^>]+src=[\"']/tyre-enquiry\.js[\"'][^>]*></script>"#,
        with: "",
        requiredTag: "the /tyre-enquiry.js script"
    )
    html = try replacingMatches(
        in: html,
        pattern: #"<script[^>]+src=[\"']/tyrescope-embed\.js[\"'][^>]*></script>"#,
        with: "",
        requiredTag: "the /tyrescope-embed.js script"
    )
    html = try replacingMatches(
        in: html,
        pattern: #"<script[^>]+src=[\"']/app\.js[\"'][^>]*></script>"#,
        with: instrumentation + runner,
        requiredTag: "the /app.js script"
    )
    return html
}

private let auditScript = #"""
(function () {
  function selector(element) {
    var value = element.tagName.toLowerCase();
    if (element.id) value += '#' + element.id;
    if (element.className && typeof element.className === 'string') {
      var classes = element.className.trim().replace(/\s+/g, '.');
      if (classes) value += '.' + classes;
    }
    return value;
  }
  function normalizePath(path) {
    return path.length > 1 ? path.replace(/\/+$/, '') : path;
  }
  function conciseSource(image) {
    var source = image.currentSrc || image.src || '';
    if (source.indexOf('data:') === 0) {
      return source.slice(0, source.indexOf(';')) + ';base64,…';
    }
    return source;
  }

  var anchors = Array.prototype.slice.call(document.querySelectorAll('a[href]'));
  var internalLinks = [];
  anchors.forEach(function (anchor) {
    var rawHref = anchor.getAttribute('href') || '';
    if (rawHref.charAt(0) === '#') return;
    var url = new URL(anchor.href, location.href);
    if (url.origin === location.origin) internalLinks.push(normalizePath(url.pathname));
  });
  internalLinks = internalLinks.filter(function (value, index, values) {
    return values.indexOf(value) === index;
  });

  var overflowElements = Array.prototype.filter.call(
    document.querySelectorAll('body *'),
    function (element) {
      var rect = element.getBoundingClientRect();
      return rect.left < -1 || rect.right > window.innerWidth + 1;
    }
  ).slice(0, 30).map(selector);

  var idCounts = {};
  Array.prototype.forEach.call(document.querySelectorAll('[id]'), function (element) {
    idCounts[element.id] = (idCounts[element.id] || 0) + 1;
  });

  var menu = document.querySelector('.menu-toggle');
  return JSON.stringify({
    href: location.href,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    document: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight
    },
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    overflowElements: overflowElements,
    jsErrors: window.__captureConsole || [],
    brokenImages: Array.prototype.filter.call(document.images, function (image) {
      return !image.complete || image.naturalWidth === 0;
    }).map(function (image) {
      return { src: conciseSource(image), alt: image.alt };
    }),
    internalLinks: internalLinks,
    brokenInternalLinks: internalLinks.filter(function (path) {
      return window.__captureKnownRoutes.indexOf(path) < 0;
    }),
    deadHashes: anchors.filter(function (anchor) {
      var href = anchor.getAttribute('href') || '';
      return href.charAt(0) === '#' && !document.getElementById(href.slice(1));
    }).map(function (anchor) {
      return anchor.getAttribute('href');
    }),
    duplicateIds: Object.keys(idCounts).filter(function (id) {
      return idCounts[id] > 1;
    }).map(function (id) {
      return { id: id, count: idCounts[id] };
    }),
    activeNav: Array.prototype.map.call(document.querySelectorAll('nav a.is-active'), function (anchor) {
      return { href: anchor.getAttribute('href'), text: anchor.textContent.trim() };
    }),
    ariaExpanded: menu ? menu.getAttribute('aria-expanded') : null,
    bodyClass: document.body.className,
    bodyOverflow: getComputedStyle(document.body).overflow,
    bodyOverflowY: getComputedStyle(document.body).overflowY,
    mainHasFocus: document.activeElement === document.querySelector('#main-content'),
    cookieChoice: sessionStorage.getItem('ossett-cookie-choice'),
    cookieNoticePresent: Boolean(document.querySelector('[data-cookie-notice]')),
    reviewTransform: (document.querySelector('[data-review-track]') || {}).style &&
      document.querySelector('[data-review-track]').style.transform || null,
    reviewPauseLabel: (document.querySelector('[data-review-pause]') || {}).getAttribute &&
      document.querySelector('[data-review-pause]').getAttribute('aria-label') || null,
    tyreState: (function () {
      var status = document.querySelector('[data-tyre-status]');
      var registration = document.querySelector('[name="registration"]');
      var form = document.querySelector('[data-tyre-form]');
      var name = form && form.querySelector('[name="name"]');
      var phone = form && form.querySelector('[name="phone"]');
      if (!status) return null;
      return {
        className: status.className,
        text: status.textContent.trim(),
        formValid: form ? form.checkValidity() : null,
        name: name ? name.value : '',
        phone: phone ? phone.value : '',
        registration: registration ? registration.value : '',
        emailLink: Boolean(status.querySelector('a[href^="mailto:"]')),
        phoneLink: Boolean(status.querySelector('a[href^="tel:"]'))
      };
    })(),
    tyrescopeState: (document.querySelector('[data-tyrescope-embed]') || {}).dataset &&
      document.querySelector('[data-tyrescope-embed]').dataset.tyrescopeState || null,
    menuPanel: (function () {
      var panel = document.querySelector('.primary-nav');
      if (!panel) return null;
      var rect = panel.getBoundingClientRect();
      var style = getComputedStyle(panel);
      return {
        className: panel.className,
        top: rect.top,
        height: rect.height,
        display: style.display,
        maxHeight: style.maxHeight,
        opacity: style.opacity,
        visibility: style.visibility
      };
    })()
  });
})()
"""#

private final class CaptureDelegate: NSObject, WebFrameLoadDelegate {
    private let arguments: CaptureArguments
    private var hasRendered = false

    init(arguments: CaptureArguments) {
        self.arguments = arguments
    }

    func webView(_ webView: WebView!, didFinishLoadFor frame: WebFrame!) {
        guard frame == webView.mainFrame, !hasRendered else { return }
        hasRendered = true

        if arguments.state == "menu-open" || arguments.state == "menu-route" || arguments.state == "menu-resize" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "var panel=document.querySelector('.primary-nav');if(panel){panel.style.transition='none';}var button=document.querySelector('.menu-toggle');if(button){button.click();}"
            )
        }

        if arguments.state == "menu-route" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "var destination=document.querySelector('.primary-nav a[href=\"/services\"]');if(destination){destination.click();}"
            )
        }

        if arguments.state == "menu-resize" {
            webView.setFrameSize(NSSize(width: 1024, height: arguments.viewportHeight))
        }

        if arguments.state == "skip-link" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "var skip=document.querySelector('.skip-link');if(skip){skip.click();}"
            )
        }

        if arguments.state == "cookie-accept" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "var accept=document.querySelector('[data-cookie-accept]');if(accept){accept.click();}"
            )
        }

        if arguments.state == "review-controls" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "var next=document.querySelector('[data-review-next]');if(next){next.click();}var pause=document.querySelector('[data-review-pause]');if(pause){pause.click();}"
            )
        }

        if arguments.state == "tyre-manual" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "var form=document.querySelector('[data-tyre-form]');if(form){var nameInput=form.querySelector('[name=\"name\"]');var phoneInput=form.querySelector('[name=\"phone\"]');var registrationInput=form.querySelector('[name=\"registration\"]');nameInput.value='Ada Lovelace';phoneInput.value='07380 439443';registrationInput.value='ab12 cde!!';registrationInput.dispatchEvent(new Event('input',{bubbles:true}));var submitButton=form.querySelector('[type=\"submit\"]');if(submitButton){submitButton.click();}}"
            )
        }

        if arguments.state == "enquiry-details" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "document.documentElement.style.scrollBehavior='auto';var form=document.querySelector('[data-enquiry-form]');if(form){form.querySelector('[name=\"name\"]').value='Ada Lovelace';form.querySelector('[name=\"phone\"]').value='07380 439443';var registration=form.querySelector('[name=\"registration\"]');registration.value='AB12CDE';var manual=form.querySelector('[data-enquiry-manual]');manual.hidden=false;manual.click();form.querySelector('[name=\"frontTyreManual\"]').value='225/45 R17';form.querySelector('[name=\"frontQuantity\"]').value='2';form.querySelector('[name=\"rearTyreManual\"]').value='255/40 R17';form.querySelector('[name=\"rearQuantity\"]').value='2';form.querySelector('[name=\"budgetTier\"]').value='Mid-range';form.querySelector('[name=\"email\"]').value='ada@example.test';window.setTimeout(function(){window.scrollTo(0,0);},250);}"
            )
        }

        if arguments.state == "popstate" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "var destination=document.querySelector('.primary-nav a[href=\"/services\"]');if(destination){destination.click();history.replaceState({},'', '/');window.dispatchEvent(new PopStateEvent('popstate'));}"
            )
        }

        if arguments.state == "tyrescope-configured" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "var container=document.querySelector('[data-tyrescope-embed]');if(container){container.dataset.tyrescopeState='ready';var stage=container.querySelector('.tyrescope-stage');var fallback=container.querySelector('[data-tyrescope-fallback]');if(fallback){fallback.hidden=true;}if(stage){stage.innerHTML='<div style=\"min-height:680px;padding:34px;background:#fff;color:#242c36\"><p style=\"font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#1258d6\">Official ecommerce test surface</p><h3 style=\"margin:14px 0;font-size:32px\">Search tyres by registration</h3><p>This capture uses a non-purchasing layout fixture. The production frame URL must come from TyreScope.</p><label style=\"display:block;margin-top:30px;font-weight:700\">Registration<input style=\"display:block;width:100%;margin-top:8px;padding:14px;border:1px solid #aeb8c7\" value=\"AB12 CDE\"></label></div>';}}"
            )
        }

        if arguments.state == "tyrescope-error" {
            _ = webView.stringByEvaluatingJavaScript(
                from: "var container=document.querySelector('[data-tyrescope-embed]');if(container){container.dataset.tyrescopeState='error';var frame=container.querySelector('[data-tyrescope-frame]');var fallback=container.querySelector('[data-tyrescope-fallback]');var status=container.querySelector('[data-tyrescope-status]');if(frame){frame.hidden=true;}if(fallback){fallback.hidden=false;}if(status){status.textContent='Online tyre ordering is unavailable just now. Use the registration check below or contact the workshop.';}}"
            )
        }

        _ = webView.stringByEvaluatingJavaScript(
            from: "document.body.classList.add('capture-full-page');"
        )

        let delay = arguments.state == "default" ? 0 : 0.35
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [self] in
            render(webView)
        }
    }

    private func render(_ webView: WebView) {
        guard let auditJSON = webView.stringByEvaluatingJavaScript(from: auditScript),
              !auditJSON.isEmpty else {
            fail(CaptureError.javascriptAudit.localizedDescription)
        }
        print(auditJSON)

        guard let documentView = webView.mainFrame.frameView.documentView else {
            fail(CaptureError.invalidDocument.localizedDescription)
        }
        documentView.layoutSubtreeIfNeeded()
        documentView.displayIfNeeded()

        let captureRect = NSRect(
            x: 0,
            y: 0,
            width: arguments.viewportWidth,
            height: max(1, documentView.bounds.height)
        )
        guard let bitmap = documentView.bitmapImageRepForCachingDisplay(in: captureRect) else {
            fail(CaptureError.invalidDocument.localizedDescription)
        }
        documentView.cacheDisplay(in: captureRect, to: bitmap)
        guard let png = bitmap.representation(using: .png, properties: [:]) else {
            fail(CaptureError.pngEncoding.localizedDescription)
        }

        do {
            try FileManager.default.createDirectory(
                at: arguments.outputURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try png.write(to: arguments.outputURL, options: .atomic)
        } catch {
            fail("Snapshot write failed: \(error.localizedDescription)")
        }

        let summary = "Captured \(Int(arguments.viewportWidth))x\(Int(captureRect.height)) CSS px -> \(arguments.outputURL.path)\n"
        FileHandle.standardError.write(Data(summary.utf8))
        fflush(stdout)
        fflush(stderr)
        exit(0)
    }
}

guard let arguments = CaptureArguments() else {
    exit(2)
}

let siteRoot = URL(
    fileURLWithPath: FileManager.default.currentDirectoryPath,
    isDirectory: true
).standardizedFileURL

let html: String
do {
    html = try preparedDocument(siteRoot: siteRoot, state: arguments.state)
} catch {
    fail(error.localizedDescription)
}

private let delegate = CaptureDelegate(arguments: arguments)
let webView = WebView(
    frame: NSRect(
        x: 0,
        y: 0,
        width: arguments.viewportWidth,
        height: arguments.viewportHeight
    ),
    frameName: nil,
    groupName: nil
)!
webView.drawsBackground = true
webView.frameLoadDelegate = delegate
webView.mainFrame.loadHTMLString(
    html,
    baseURL: URL(string: "https://local.test\(arguments.route)")!
)

DispatchQueue.main.asyncAfter(deadline: .now() + 20) {
    fail("Timed out waiting for the page to render")
}
RunLoop.main.run()
