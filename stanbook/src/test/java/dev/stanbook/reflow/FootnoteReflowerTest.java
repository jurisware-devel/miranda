package dev.stanbook.reflow;

import static org.assertj.core.api.Assertions.assertThat;

import dev.stanbook.ir.lowered.Footnote;
import dev.stanbook.ir.lowered.FootnoteSection;
import dev.stanbook.ir.render.BlockType;
import dev.stanbook.ir.source.SourceLine;
import java.util.List;
import org.junit.jupiter.api.Test;

class FootnoteReflowerTest {
    private final FootnoteReflower reflower = new FootnoteReflower();

    @Test
    void joins_wrapped_lines_and_preserves_blank_breaks() {
        Footnote footnote = new Footnote(
            "1",
            List.of(
                new SourceLine(111, "First wrapped"),
                new SourceLine(112, "line."),
                new SourceLine(113, ""),
                new SourceLine(114, "Second paragraph"),
                new SourceLine(115, "here.")
            ),
            111,
            115
        );

        var blocks = reflower.reflowFootnote(footnote);

        assertThat(blocks).hasSize(2);
        assertThat(blocks.get(0).type()).isEqualTo(BlockType.FOOTNOTE_PARAGRAPH);
        assertThat(blocks.get(0).text()).isEqualTo("First wrapped line.");
        assertThat(blocks.get(1).text()).isEqualTo("Second paragraph here.");
    }

    @Test
    void returns_blocks_by_label() {
        var section = new FootnoteSection(
            120,
            List.of(
                new Footnote("1", List.of(new SourceLine(121, "Alpha")), 121, 121),
                new Footnote("2", List.of(new SourceLine(122, "Beta"), new SourceLine(123, "continued.")), 122, 123)
            ),
            List.of()
        );

        var reflowed = reflower.reflow(section);

        assertThat(reflowed.blocksByStartLine().keySet()).containsExactlyInAnyOrder(121, 122);
        assertThat(reflowed.blocksByStartLine().get(122).getFirst().text()).isEqualTo("Beta continued.");
    }
}
