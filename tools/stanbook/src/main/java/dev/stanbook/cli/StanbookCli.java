package dev.stanbook.cli;

import dev.stanbook.io.SourceDocumentReader;
import dev.stanbook.pipeline.StanbookPipeline;
import dev.stanbook.render.json.MirandaJsonRenderer.CanonicalTextDiagnostic;
import java.io.IOException;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

public final class StanbookCli {
    private static final int QA_MISMATCH_REPORT_LIMIT = 10;

    private StanbookCli() {}

    public static void main(String[] args) {
        int exitCode = run(args, System.out, System.err);
        if (exitCode != 0) {
            System.exit(exitCode);
        }
    }

    static int run(String[] args, PrintStream out, PrintStream err) {
        if (args.length == 2 && "--qa-diff".equals(args[0])) {
            return qaDiff(Path.of(args[1]), out, err);
        }

        if (args.length != 1) {
            err.println("Usage: stanbook <path>");
            err.println("   or: stanbook --qa-diff <html-file>");
            return 2;
        }

        Path path = Path.of(args[0]);
        if (Files.isDirectory(path)) {
            return renderDirectory(path, err);
        }

        if (!Files.isRegularFile(path)) {
            err.println("Not a file or directory: " + path);
            return 2;
        }

        String lowerName = path.getFileName().toString().toLowerCase();
        if (!lowerName.endsWith(".htm") && !lowerName.endsWith(".html")) {
            err.println("Expected an .htm or .html file: " + path);
            return 2;
        }

        out.print(renderFile(path));
        return 0;
    }

    private static int qaDiff(Path path, PrintStream out, PrintStream err) {
        if (Files.isDirectory(path)) {
            return qaDiffDirectory(path, out, err);
        }
        if (!Files.isRegularFile(path)) {
            err.println("Not a file or directory: " + path);
            return 2;
        }
        if (!isHtmlFile(path)) {
            err.println("Expected an .htm or .html file: " + path);
            return 2;
        }

        var reader = new SourceDocumentReader();
        var pipeline = StanbookPipeline.createDefault();
        var source = reader.read(path);
        CanonicalTextDiagnostic diagnostic = pipeline.diagnoseCanonicalText(source);

        out.println("canonical-text-match: " + diagnostic.matches());
        out.println("source-lines: " + countLines(diagnostic.sourceText()));
        out.println("structured-lines: " + countLines(diagnostic.structuredText()));
        out.println("--- diff ---");
        out.println(diagnostic.diff());
        return diagnostic.matches() ? 0 : 1;
    }

    private static int qaDiffDirectory(Path root, PrintStream out, PrintStream err) {
        List<Path> htmlFiles = collectHtmlFiles(root, err);
        if (htmlFiles == null) {
            return 1;
        }

        var reader = new SourceDocumentReader();
        var pipeline = StanbookPipeline.createDefault();
        int matched = 0;
        int mismatched = 0;
        List<String> mismatchReports = new ArrayList<>();

        for (Path htmlFile : htmlFiles) {
            CanonicalTextDiagnostic diagnostic = pipeline.diagnoseCanonicalText(reader.read(htmlFile));
            if (diagnostic.matches()) {
                matched += 1;
                continue;
            }

            mismatched += 1;
            if (mismatchReports.size() < QA_MISMATCH_REPORT_LIMIT) {
                mismatchReports.add(formatMismatchReport(root, htmlFile, diagnostic));
            }
        }

        out.println("qa-files-checked: " + htmlFiles.size());
        out.println("qa-files-matched: " + matched);
        out.println("qa-files-mismatched: " + mismatched);
        if (!mismatchReports.isEmpty()) {
            out.println("--- mismatches ---");
            mismatchReports.forEach(out::println);
        }
        return mismatched == 0 ? 0 : 1;
    }

    private static int renderDirectory(Path root, PrintStream err) {
        List<Path> htmlFiles = collectHtmlFiles(root, err);
        if (htmlFiles == null) {
            return 1;
        }

        int processed = 0;
        int failed = 0;
        for (Path htmlFile : htmlFiles) {
            Path jsonFile = siblingJsonPath(htmlFile);
            err.println("stanbook: " + htmlFile + " -> " + jsonFile);
            try {
                Files.writeString(jsonFile, renderFile(htmlFile), StandardCharsets.UTF_8);
                processed += 1;
            } catch (Exception exception) {
                err.println("stanbook: failed for " + htmlFile);
                try {
                    Files.deleteIfExists(jsonFile);
                } catch (IOException ignored) {
                    // Best effort cleanup after a failed write.
                }
                failed += 1;
            }
        }

        err.println("stanbook-dir: wrote " + processed + " JSON file(s)");
        if (failed > 0) {
            err.println("stanbook-dir: " + failed + " file(s) failed");
            return 1;
        }
        return 0;
    }

    private static List<Path> collectHtmlFiles(Path root, PrintStream err) {
        try (Stream<Path> paths = Files.walk(root)) {
            return paths
                .filter(Files::isRegularFile)
                .filter(StanbookCli::isHtmlFile)
                .sorted(Comparator.naturalOrder())
                .toList();
        } catch (IOException exception) {
            err.println("Failed to read directory: " + root);
            return null;
        }
    }

    private static String renderFile(Path path) {
        var reader = new SourceDocumentReader();
        var pipeline = StanbookPipeline.createDefault();
        var source = reader.read(path);
        return pipeline.render(source);
    }

    private static boolean isHtmlFile(Path path) {
        String lowerName = path.getFileName().toString().toLowerCase();
        return lowerName.endsWith(".htm") || lowerName.endsWith(".html");
    }

    private static int countLines(String text) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        return text.split("\\R", -1).length;
    }

    private static String formatMismatchReport(Path root, Path htmlFile, CanonicalTextDiagnostic diagnostic) {
        String displayPath = root.equals(htmlFile) ? htmlFile.getFileName().toString() : root.relativize(htmlFile).toString();
        return displayPath
            + System.lineSeparator()
            + diagnostic.diff();
    }

    private static Path siblingJsonPath(Path htmlFile) {
        String fileName = htmlFile.getFileName().toString();
        int extensionIndex = fileName.lastIndexOf('.');
        String jsonFileName = (extensionIndex >= 0 ? fileName.substring(0, extensionIndex) : fileName) + ".json";
        return htmlFile.resolveSibling(jsonFileName);
    }
}
