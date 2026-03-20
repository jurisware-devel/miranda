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
        assertThat(json).contains("\"label\":\"RIVERA, J. (concurring)\"");
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
        assertThat(json).contains("\"opinionLines\":[");
        assertThat(json).contains("Judge Rivera concurs in result in an opinion.");
        assertThat(json).contains("\"kind\":\"concurrence\"");
    }

    @Test
    void render_json_splits_strong_action_from_judge_summary() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00004</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <p>Body text.</p>
            <p>Appeal dismissed without prejudice, in a memorandum. Chief Judge Wilson and Judges Rivera, Garcia, Singas, Cannataro, Troutman and Halligan concur.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"disposition\":{");
        assertThat(json).contains("\"text\":\"Appeal dismissed without prejudice, in a memorandum. Chief Judge Wilson and Judges Rivera, Garcia, Singas, Cannataro, Troutman and Halligan concur.\"");
        assertThat(json).contains("\"parts\":[{\"type\":\"action\",\"text\":\"Appeal dismissed without prejudice, in a memorandum.\"},{\"type\":\"summary\",\"text\":\"Chief Judge Wilson and Judges Rivera, Garcia, Singas, Cannataro, Troutman and Halligan concur.\"}]");
    }

    @Test
    void render_json_emits_multi_judge_concurrence_as_separate_writing() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00008</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
              <tr><td>Per Curiam</td></tr>
            </table>
            <p>Per Curiam.</p>
            <p>Majority text.</p>
            <p>G.B. Smith, Rosenblatt and R.S. Smith, JJ. (concurring). Concurrence text.</p>
            <p>Order affirmed. Chief Judge Wilson and Judges Rivera, Garcia, Singas, Cannataro, Troutman and Halligan concur.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"kind\":\"concurrence\"");
        assertThat(json).contains("\"label\":\"G.B. Smith, Rosenblatt and R.S. Smith, JJ. (concurring)\"");
        assertThat(json).contains("Concurrence text.");
    }

    @Test
    void render_json_preserves_leading_article_after_emphasized_author_marker_split() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00010</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Per Curiam.</p>
            <p>Graffeo, J. (concurring in <i>McPherson</i> and dissenting in <i>Suarez</i>). The majority concludes that this text should keep its leading article.</p>
            <p>Order affirmed.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("The majority concludes that this text should keep its leading article.");
    }

    @Test
    void render_json_preserves_spaces_in_emphasized_appearance_lines() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00012</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p><i>Kuby & Perez LLP, </i>New York City (<i>Ronald L. Kuby </i>of counsel), for appellant.</p>
            <p>Per Curiam.</p>
            <p>Body text.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"text\":\"*Kuby & Perez LLP,* New York City (*Ronald L. Kuby* of counsel), for appellant.\"");
    }

    @Test
    void render_json_groups_consecutive_blockquotes_into_single_quote_block() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00013</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <p>Intro paragraph.</p>
            <blockquote>"the court: You were not the victim of a rape?</blockquote>
            <blockquote>"juror twelve: Not with him.</blockquote>
            <blockquote>"the court: With anybody, were you ever the victim of a rape?</blockquote>
            <p>Closing paragraph.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"type\":\"quote\"");
        assertThat(json).contains("\"blocks\":[{\"type\":\"paragraph\"");
        assertThat(json).contains("\\\"the court: You were not the victim of a rape?");
        assertThat(json).contains("\\\"juror twelve: Not with him.");
        assertThat(json).contains("\\\"the court: With anybody, were you ever the victim of a rape?");
    }

    @Test
    void render_json_preserves_caption_party_lines_in_header() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00003</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <table>
              <tr><td>The People of the State of New York, Respondent,</td></tr>
              <tr><td>v</td></tr>
              <tr><td>John Doe, Appellant.</td></tr>
            </table>
            <p>Memorandum.</p>
            <p>Order affirmed.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"caption\":[\"The People of the State of New York, Respondent,\",\"v\",\"John Doe, Appellant.\"]");
    }

    @Test
    void render_json_preserves_caption_party_lines_from_single_table_cell_with_breaks() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00003</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <table>
              <tr><td><b>The People of the State of New York, Respondent,<br>v<br>John Doe, Appellant.</b></td></tr>
            </table>
            <p>Memorandum.</p>
            <p>Order affirmed.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"caption\":[\"The People of the State of New York, Respondent,\",\"v\",\"John Doe, Appellant.\"]");
    }

    @Test
    void render_json_leaves_per_curiam_majority_author_null() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00006</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Per Curiam.</p>
            <p>Body text.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"kind\":\"majority\"");
        assertThat(json).contains("\"author\":null");
        assertThat(json).contains("\"authorStatus\":\"anonymous\"");
        assertThat(json).doesNotContain("\"kind\":\"per_curiam\"");
    }
}
