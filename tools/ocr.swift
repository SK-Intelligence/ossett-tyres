import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write(Data("Usage: swift tools/ocr.swift <image>\n".utf8))
    exit(2)
}

let imageURL = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = NSImage(contentsOf: imageURL) else {
    FileHandle.standardError.write(Data("Could not decode \(imageURL.path)\n".utf8))
    exit(1)
}

let sourceSize = image.size
let scale = min(1, 1_600 / sourceSize.width, 5_000 / sourceSize.height)
let renderSize = NSSize(
    width: max(1, floor(sourceSize.width * scale)),
    height: max(1, floor(sourceSize.height * scale))
)
let resizedImage = NSImage(size: renderSize)
resizedImage.lockFocus()
NSGraphicsContext.current?.imageInterpolation = .high
image.draw(
    in: NSRect(origin: .zero, size: renderSize),
    from: NSRect(origin: .zero, size: sourceSize),
    operation: .copy,
    fraction: 1
)
resizedImage.unlockFocus()

guard let data = resizedImage.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: data),
      let cgImage = bitmap.cgImage else {
    FileHandle.standardError.write(Data("Could not prepare \(imageURL.path) for OCR\n".utf8))
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["en-GB"]
request.usesLanguageCorrection = true

do {
    try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
    let observations = (request.results ?? []).sorted { left, right in
        let verticalDifference = abs(left.boundingBox.maxY - right.boundingBox.maxY)
        if verticalDifference < 0.006 {
            return left.boundingBox.minX < right.boundingBox.minX
        }
        return left.boundingBox.maxY > right.boundingBox.maxY
    }
    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }
        print(candidate.string)
    }
} catch {
    FileHandle.standardError.write(Data("OCR failed: \(error.localizedDescription)\n".utf8))
    exit(1)
}
