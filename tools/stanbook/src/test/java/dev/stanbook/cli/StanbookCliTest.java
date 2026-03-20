package dev.stanbook.cli;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class StanbookCliTest {
    @TempDir
    Path tempDir;

    @Test
    void run_renders_single_file_to_stdout() throws Exception {
        Path html = tempDir.resolve("single.htm");
        Files.writeString(html, """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00001</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            </body></html>
            """, StandardCharsets.UTF_8);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();

        int exitCode = StanbookCli.run(
            new String[] {html.toString()},
            new PrintStream(out, true, StandardCharsets.UTF_8),
            new PrintStream(err, true, StandardCharsets.UTF_8)
        );

        assertThat(exitCode).isZero();
        assertThat(out.toString(StandardCharsets.UTF_8)).contains("\"title\":\"People v Example\"");
        assertThat(err.toString(StandardCharsets.UTF_8)).isEmpty();
    }

    @Test
    void run_renders_directory_to_sibling_json_files() throws Exception {
        Path root = tempDir.resolve("opinions");
        Files.createDirectories(root.resolve("2026"));
        Path html = root.resolve("2026/example.htm");
        Files.writeString(html, """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00001</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            </body></html>
            """, StandardCharsets.UTF_8);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ByteArrayOutputStream err = new ByteArrayOutputStream();

        int exitCode = StanbookCli.run(
            new String[] {root.toString()},
            new PrintStream(out, true, StandardCharsets.UTF_8),
            new PrintStream(err, true, StandardCharsets.UTF_8)
        );

        Path json = root.resolve("2026/example.json");
        assertThat(exitCode).isZero();
        assertThat(out.toString(StandardCharsets.UTF_8)).isEmpty();
        assertThat(Files.readString(json, StandardCharsets.UTF_8)).contains("\"title\":\"People v Example\"");
        assertThat(err.toString(StandardCharsets.UTF_8)).contains("stanbook-dir: wrote 1 JSON file(s)");
    }
}
