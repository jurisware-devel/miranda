package dev.stanbook.render.json;

import static org.assertj.core.api.Assertions.assertThat;

import dev.stanbook.io.HtmlSourceLoader;
import dev.stanbook.io.SourceDocumentReader;
import dev.stanbook.pipeline.StanbookPipeline;
import dev.stanbook.ir.source.SourceDocument;
import dev.stanbook.ir.source.SourceNoteAnomaly;
import dev.stanbook.ir.source.SourceNoteAppearance;
import dev.stanbook.ir.source.SourceNotes;
import java.nio.file.Path;
import java.util.List;
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
        assertThat(json).contains("\"kind\":\"concurrence\"");
        assertThat(json).contains("\"author\":\"Rivera\"");
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
    void render_json_linkifies_available_at_urls_in_plain_text_blocks() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00016</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <p>See report, available at https://example.com/report.pdf [last accessed Jan. 1, 2026].</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"type\":\"link\"");
        assertThat(json).contains("\"href\":\"https://example.com/report.pdf\"");
        assertThat(json).contains("\"text\":\"See report, available at https://example.com/report.pdf [last accessed Jan. 1, 2026].\"");
    }

    @Test
    void render_json_linkifies_available_at_urls_split_by_page_markers() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00017</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <p>Source, available at https://example.com/a-dis<font color="FF0000">{**1 NY3d at 2}</font>proportionate.pdf; discussed here.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"href\":\"https://example.com/a-disproportionate.pdf\"");
        assertThat(json).contains("\"type\":\"page_marker\"");
        assertThat(json).doesNotContain("\"href\":\"https://example.com/a-dis\"");
    }

    @Test
    void render_json_extracts_official_citation_from_parenthetical_slip_op_line() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2025 NY Slip Op 02100 (44 NY3d 1)</td></tr>
              <tr><td>April 10, 2025</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <p>Body text.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"slipOpinion\":\"2025 NY Slip Op 02100\"");
        assertThat(json).contains("\"officialCitation\":\"44 NY3d 1\"");
        assertThat(json).doesNotContain("\"officialCitation\":\"2025 NY Slip Op 02100 (44 NY3d 1)\"");
    }

    @Test
    void render_json_keeps_points_of_counsel_out_of_appearances() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2025 NY Slip Op 02100 (44 NY3d 1)</td></tr>
              <tr><td>April 10, 2025</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <CounselBlock type="points_of">
              <div align="center"><b>POINTS OF COUNSEL</b></div>
              <p><i>Mitchell H. Spinac</i>, Kingston, for appellant. I. First argument. II. Second argument.</p>
              <p><i>Emmanuel C. Nneji, District Attorney</i>, Kingston, for respondent. I. Response argument.</p>
            </CounselBlock>
            <p>OPINION OF THE COURT</p>
            <p>Body text.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"appearances\":[");
        assertThat(json).contains("\"text\":\"*Mitchell H. Spinac*, Kingston, for appellant.\"");
        assertThat(json).contains("\"text\":\"*Emmanuel C. Nneji, District Attorney*, Kingston, for respondent.\"");
        assertThat(json).contains("\"pointsOfCounsel\":[");
        assertThat(json).contains("First argument.");
        assertThat(json).contains("\"appearances\":[{\"side\":\"appellant\",\"text\":\"*Mitchell H. Spinac*, Kingston, for appellant.\"");
    }

    @Test
    void render_json_merges_header_and_points_of_counsel_appearances() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2025 NY Slip Op 02100 (44 NY3d 1)</td></tr>
              <tr><td>April 10, 2025</td></tr>
              <tr><td>Court of Appeals</td></tr>
              <tr><td><i>Mitchell H. Spinac</i>, Kingston, for appellant.</td></tr>
            </table>
            <CounselBlock type="points_of">
              <div align="center"><b>POINTS OF COUNSEL</b></div>
              <p><i>Mitchell H. Spinac</i>, Kingston, for appellant. I. First argument. II. Second argument.</p>
              <p><i>Emmanuel C. Nneji, District Attorney</i>, Kingston, for respondent. I. Response argument.</p>
              <p><i>Legal Action Network for Animals</i>, Great Neck, for amicus curiae. I. Amicus argument.</p>
            </CounselBlock>
            <p>OPINION OF THE COURT</p>
            <p>Body text.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"text\":\"*Mitchell H. Spinac*, Kingston, for appellant.\"");
        assertThat(json).contains("\"text\":\"*Emmanuel C. Nneji, District Attorney*, Kingston, for respondent.\"");
        assertThat(json).contains("\"text\":\"*Legal Action Network for Animals*, Great Neck, for amicus curiae.\"");
        assertThat(json).contains("\"pointsOfCounsel\":[");
        assertThat(json).contains("Response argument.");
        assertThat(json).contains("Amicus argument.");
    }

    @Test
    void render_json_trims_non_numbered_points_of_counsel_arguments_from_appearances() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2025 NY Slip Op 01673 [43 NY3d 584]</td></tr>
              <tr><td>March 20, 2025</td></tr>
              <tr><td>Court of Appeals</td></tr>
              <tr><td><i>Julie A. Cianca, Public Defender</i>, Rochester (<i>David R. Juergens</i> of counsel), for appellant. When determining an offender's risk level, the court cannot use a coerced guilty plea as an automatic override. <i>Sandra Doorley, District Attorney</i>, Rochester (<i>Martin P. McCarthy</i> of counsel), for respondent. The SORA court properly applied the override.</td></tr>
            </table>
            <CounselBlock type="points_of">
              <div align="center"><b>POINTS OF COUNSEL</b></div>
              <p><i>Julie A. Cianca, Public Defender</i>, Rochester (<i>David R. Juergens</i> of counsel), for appellant. When determining an offender's risk level, the court cannot use a coerced guilty plea as an automatic override.</p>
              <p><i>Sandra Doorley, District Attorney</i>, Rochester (<i>Martin P. McCarthy</i> of counsel), for respondent. The SORA court properly applied the override.</p>
            </CounselBlock>
            <p>OPINION OF THE COURT</p>
            <p>Body text.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"text\":\"*Julie A. Cianca, Public Defender*, Rochester (*David R. Juergens* of counsel), for appellant.\"");
        assertThat(json).contains("\"text\":\"*Sandra Doorley, District Attorney*, Rochester (*Martin P. McCarthy* of counsel), for respondent.\"");
        assertThat(json).contains("\"pointsOfCounsel\":[");
        assertThat(json).contains("automatic override");
        assertThat(json).contains("properly applied the override");
    }

    @Test
    void render_json_trims_plural_amici_curiae_appearance_lines() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2008 NY Slip Op 04902 [10 NY3d 875]</td></tr>
              <tr><td>June 3, 2008</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <CounselBlock type="points_of">
              <div align="center"><b>POINTS OF COUNSEL</b></div>
              <p><i>Lorca Morello</i>, New York City, <i>Steven Banks, Richard Willstatter</i>, White Plains, and <i>Alfred O'Connor</i>, Albany, for Legal Aid Society and others, amici curiae. The amici argue that the lineup procedure was unreliable.</p>
            </CounselBlock>
            <p>OPINION OF THE COURT</p>
            <p>Body text.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"text\":\"*Lorca Morello*, New York City, *Steven Banks, Richard Willstatter*, White Plains, and *Alfred O'Connor*, Albany, for Legal Aid Society and others, amici curiae.\"");
        assertThat(json).contains("\"pointsOfCounsel\":[");
        assertThat(json).contains("The amici argue that the lineup procedure was unreliable.");
    }

    @Test
    void render_json_uses_notes_backed_appearance_recovery_for_malformed_container_cases() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2004 NY Slip Op 02259 [2 NY3d 725]</td></tr>
              <tr><td>March 25, 2004</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>APPEARANCES OF COUNSEL</p>
            <p><i>Center for Appellate Litigation</i>, New York City (<i>Laura I. Appleman</i> and <i>Robert S. Dean</i> of counsel), for appellant.</p>
            <p><i>Robert M. Morgenthau, District Attorney</i>, New York City (<i>Meredith Boylan</i> and <i>Susan Axelrod</i> of counsel), for respondent.</appcouns>
            <p>OPINION OF THE COURT</p>
            <p>Body text.</p>
            </body></html>
            """;

        HtmlSourceLoader loader = new HtmlSourceLoader();
        SourceDocument source = loader.load(Path.of("example.htm"), html);
        SourceNotes notes = new SourceNotes(
            "example",
            new SourceNotes.HeaderNotes(List.of(
                new SourceNoteAppearance(
                    "Center for Appellate Litigation, New York City (Laura I. Appleman and Robert S. Dean of counsel), for appellant.",
                    "appellant",
                    "Center for Appellate Litigation, New York City (Laura I. Appleman and Robert S. Dean of counsel), for appellant."
                ),
                new SourceNoteAppearance(
                    "Robert M. Morgenthau, District Attorney, New York City (Meredith Boylan and Susan Axelrod of counsel), for respondent.",
                    "respondent",
                    "Robert M. Morgenthau, District Attorney, New York City (Meredith Boylan and Susan Axelrod of counsel), for respondent."
                )
            )),
            List.of(
                new SourceNoteAnomaly("MALFORMED_APPEARANCES_CONTAINER", "warning", "Malformed appearances container.")
            )
        );
        SourceDocument sourceWithNotes = new SourceDocument(source.path(), source.lines(), source.htmlDocument(), notes);

        String json = StanbookPipeline.createDefault().render(sourceWithNotes);

        assertThat(json).contains("\"text\":\"Center for Appellate Litigation, New York City (Laura I. Appleman and Robert S. Dean of counsel), for appellant.\"");
        assertThat(json).contains("\"text\":\"Robert M. Morgenthau, District Attorney, New York City (Meredith Boylan and Susan Axelrod of counsel), for respondent.\"");
        assertThat(json).contains("\"code\":\"notes_malformed_appearances_container\"");
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
    void render_json_normalizes_effective_writing_to_opinion_of_the_court() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00018</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
              <tr><td>Per Curiam</td></tr>
            </table>
            <p>Per Curiam.</p>
            <p>Memorandum (concurring).</p>
            <p>Plurality text.</p>
            <p>Chief Judge Wilson and Judges Rivera and Garcia concur, Judges Rivera and Garcia in a concurring memorandum.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"kind\":\"opinion_of_the_court\"");
        assertThat(json).contains("\"author\":null");
        assertThat(json).contains("Plurality text.");
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
    void render_json_nests_appearances_in_header_and_places_disposition_before_footnotes() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00015</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Jane Doe, for appellant.</p>
            <p>Memorandum.</p>
            <p>Body text.<sup><a href="#1FN" name="1CASE"><b>[FN1]</b></a></sup></p>
            <p>Order affirmed.</p>
            <div align="center"><b>Footnotes</b></div>
            <a name="1FN" href="#1CASE"><b>Footnote 1:</b></a> Example footnote.
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"header\":{");
        assertThat(json).contains("\"appearances\":[{\"side\":\"appellant\",\"text\":\"Jane Doe, for appellant.\"");
        assertThat(json).doesNotContain("\"header\":{},\"appearances\":");
        assertThat(json).contains("\"source\":{\"kind\":\"lrb_html\"");
        assertThat(json).contains("\"opinions\":[");
        assertThat(json).contains("\"disposition\":{\"text\":\"Order affirmed.\"");
        assertThat(json).contains("\"disposition\":{\"text\":\"Order affirmed.\",\"parts\":[{\"type\":\"action\",\"text\":\"Order affirmed.\"}],\"provenance\":");
        assertThat(json).contains("\"footnotes\":[{\"label\":\"1\"");
        assertThat(json).contains("\"debug\":{\"diagnostics\":");
        assertThat(json).contains("\"fallback\":{\"headerLines\":[");
        assertThat(json).contains("\"opinions\":[");
        assertThat(json.indexOf("\"opinions\":[")).isLessThan(json.indexOf("\"disposition\":{\"text\":\"Order affirmed.\""));
        assertThat(json.indexOf("\"disposition\":{\"text\":\"Order affirmed.\"")).isLessThan(json.indexOf("\"footnotes\":[{\"label\":\"1\""));
        assertThat(json.indexOf("\"debug\":{\"diagnostics\":")).isLessThan(json.indexOf("\"fallback\":{\"headerLines\":["));
    }

    @Test
    void render_json_preserves_unclassified_opinion_blocks_as_unknown_writing() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00014</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <p>Body text.</p>
            <p>Garcia, J. (dissenting).</p>
            <p>Order affirmed.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"kind\":\"unknown\"");
        assertThat(json).contains("\"provenance\":{\"startLine\":9,\"endLine\":9}");
        assertThat(json).contains("\"author\":\"Garcia\"");
        assertThat(json).doesNotContain("\"text\":\" (dissenting).\"");
        assertThat(json).contains("\"kind\":\"opinion_of_the_court\"");
        assertThat(json).contains("Body text.");
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
    void render_json_preserves_caption_party_lines_with_plural_role_suffixes() {
        String html = """
            <html><body>
            <table>
              <tr><td>People ex rel. McCurdy v Warden, Westchester County Corr. Facility</td></tr>
              <tr><td>2020 NY Slip Op 06933 [36 NY3d 251]</td></tr>
              <tr><td>November 23, 2020</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <table>
              <tr><td><b>The People of the State of New York ex rel. Chance McCurdy, Appellant,<br>v<br>Warden, Westchester County Correctional Facility, et al., Respondents.</b></td></tr>
            </table>
            <p>Memorandum.</p>
            <p>Order affirmed.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"caption\":[\"The People of the State of New York ex rel. Chance McCurdy, Appellant,\",\"v\",\"Warden, Westchester County Correctional Facility, et al., Respondents.\"]");
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

        assertThat(json).contains("\"kind\":\"opinion_of_the_court\"");
        assertThat(json).contains("\"author\":null");
        assertThat(json).doesNotContain("\"kind\":\"per_curiam\"");
    }

    @Test
    void render_json_emits_custom_summary_headnotes_and_points_of_counsel() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00019</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <Summary>
              <div align="center">SUMMARY</div>
              <stmcs>Statement of Case</stmcs>
              <p>Appeal from an order of the Appellate Division.</p>
            </Summary>
            <HeadnoteBlock>
              <Headnote>
                <Classification level="1">Crimes</Classification>
                <Classification level="2">Evidence</Classification>
                <p>Headnote text.</p>
              </Headnote>
            </HeadnoteBlock>
            <CounselBlock type="points_of">
              <div align="center">POINTS OF COUNSEL</div>
              <p>Appellant point.</p>
            </CounselBlock>
            <p>Memorandum.</p>
            <p>Order affirmed.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"summarySections\":[{\"label\":\"Statement of Case\",\"text\":\"Appeal from an order of the Appellate Division.\"");
        assertThat(json).contains("\"headnotes\":[{\"classification\":[\"Crimes\",\"Evidence\"],\"text\":\"Headnote text.\"");
        assertThat(json).contains("\"pointsOfCounsel\":[{\"label\":\"POINTS OF COUNSEL\",\"text\":\"Appellant point.\"");
    }

    @Test
    void render_json_emits_body_custom_tag_metadata_for_blocks() {
        String html = """
            <html><body>
            <table>
              <tr><td>People v Example</td></tr>
              <tr><td>2026 NY Slip Op 00020</td></tr>
              <tr><td>March 20, 2026</td></tr>
              <tr><td>Court of Appeals</td></tr>
            </table>
            <p>Memorandum.</p>
            <Opinion category="dissenting">
              <p><sc>WILSON</sc>, Chief Judge: Dissent opening.</p>
              <Para type="blocked">Quoted material.</Para>
            </Opinion>
            <p>Order affirmed.</p>
            </body></html>
            """;

        String json = StanbookPipeline.createDefault()
            .render(new dev.stanbook.io.HtmlSourceLoader().load(Path.of("example.htm"), html));

        assertThat(json).contains("\"sourceTags\":[\"opinion\",\"para\"]");
        assertThat(json).contains("\"sourceCategories\":[\"dissenting\"]");
        assertThat(json).contains("\"type\":\"quote\",\"sourceTag\":\"para\",\"opinionCategory\":\"dissenting\"");
        assertThat(json).contains("\"sourceTag\":\"para\"");
        assertThat(json).contains("\"opinionCategory\":\"dissenting\"");
    }
}
