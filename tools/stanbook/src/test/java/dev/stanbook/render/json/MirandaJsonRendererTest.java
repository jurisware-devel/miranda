package dev.stanbook.render.json;

import static org.assertj.core.api.Assertions.assertThat;

import dev.stanbook.io.SourceDocumentReader;
import dev.stanbook.pipeline.StanbookPipeline;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class MirandaJsonRendererTest {
    @Test
    void render_json_outputs_minimal_miranda_opinion_shape() {
        var source = new SourceDocumentReader().read(Path.of("samples/2026_00963.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"version\":\"0.1\"");
        assertThat(json).contains("\"documentType\":\"opinion\"");
        assertThat(json).contains("\"caseId\":\"2026_00963\"");
        assertThat(json).contains("\"title\":\"People v Rios\"");
        assertThat(json).contains("\"slipOpinion\":\"2026 NY Slip Op 00963\"");
        assertThat(json).contains("\"decisionDate\":\"2026-02-19\"");
        assertThat(json).contains("\"opinions\":[");
        assertThat(json).contains("\"label\":\"RIVERA, J. (concurring):\"");
        assertThat(json).contains("\"joiners\":[\"Wilson\"]");
        assertThat(json).contains("\"renderingHints\":");
        assertThat(json).contains("\"disposition\":{");
        assertThat(json).contains("\"parts\":[");
        assertThat(json).doesNotContain("\"type\":\"paragraph\",\"text\":");
        assertThat(json).doesNotContain("\"type\":\"subheader\",\"text\":");
    }

    @Test
    void render_json_preserves_inline_semantics_for_links_and_footnote_refs() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00001</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <p>See <a href="../2024/2024_00001.htm"><i>People v Example</i></a>.<sup><a href="#1FN" name="1CASE"><b>[FN1]</b></a></sup></p>
            <div align="center"><b>Footnotes</b></div>
            <a name="1FN" href="#1CASE"><b>Footnote 1:</b></a> Example footnote.
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"type\":\"link\"");
        assertThat(json).contains("\"href\":\"../2024/2024_00001.htm\"");
        assertThat(json).contains("\"type\":\"footnote_reference\"");
        assertThat(json).contains("\"label\":\"1\"");
        assertThat(json).doesNotContain("\"text\":\"See [*People v Example*]");
        assertThat(json).doesNotContain("\"type\":\"paragraph\",\"text\":");
    }

    @Test
    void render_json_emits_official_page_markers_as_inline_nodes() {
        var source = new SourceDocumentReader().read(Path.of("samples/2003_17888.htm"));

        String json = StanbookPipeline.createDefault().render(source);

        assertThat(json).contains("\"type\":\"page_marker\"");
        assertThat(json).contains("\"text\":\"{**1 NY3d at 272}\"");
        assertThat(json).contains("\"citation\":\"1 NY3d at 272\"");
    }

    @Test
    void render_json_keeps_terminal_summary_out_of_last_separate_writing() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00002</td></tr>
              <tr><td>Decided on March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
              <tr><td>Halligan</td></tr>
            </table>
            <p>Majority opening.</p>
            <p>Accordingly, the order should be reversed.</p>
            <Opinion category="concurring">
            <br>
            <sc>RIVERA</sc>, J. (concurring):
            <p>Concurrence text.</p>
            <p>Judgment reversed, without costs, and matter remitted to the Appellate Division for further proceedings in accordance with the opinion herein. Opinion by Judge Halligan. Chief Judge Wilson and Judges Garcia and Singas concur.</p>
            <p>Judge Rivera concurs in result in an opinion.</p>
            <p>Decided March 20, 2026</p>
            <div align="center"><b>Footnotes</b></div>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"disposition\":{");
        assertThat(json).contains("\"text\":\"Judgment reversed, without costs, and matter remitted to the Appellate Division for further proceedings in accordance with the opinion herein. Opinion by Judge Halligan. Chief Judge Wilson and Judges Garcia and Singas concur.\"");
        assertThat(json).contains("\"parts\":[{\"type\":\"action\",\"text\":\"Judgment reversed, without costs, and matter remitted to the Appellate Division for further proceedings in accordance with the opinion herein.\"},{\"type\":\"summary\",\"text\":\"Opinion by Judge Halligan. Chief Judge Wilson and Judges Garcia and Singas concur.\"}]");
        assertThat(json).contains("Concurrence text.");
        assertThat(json).doesNotContain("Judge Rivera concurs in result in an opinion.");
        assertThat(json).contains("\"kind\":\"concurrence\"");
    }
}
