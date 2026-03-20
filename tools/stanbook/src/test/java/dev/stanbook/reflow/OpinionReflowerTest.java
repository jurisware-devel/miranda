package dev.stanbook.reflow;

import static org.assertj.core.api.Assertions.assertThat;

import dev.stanbook.ir.lowered.OpinionBody;
import dev.stanbook.ir.lowered.OpinionComponent;
import dev.stanbook.ir.lowered.OpinionComponentType;
import dev.stanbook.ir.lowered.OpinionRole;
import dev.stanbook.ir.render.BlockType;
import dev.stanbook.ir.source.SourceLine;
import java.util.List;
import org.junit.jupiter.api.Test;

class OpinionReflowerTest {
    private final OpinionReflower reflower = new OpinionReflower();

    @Test
    void left_align_text_removes_leading_indentation() {
        assertThat(reflower.leftAlignText("        The defendant was convicted."))
            .isEqualTo("The defendant was convicted.");
    }

    @Test
    void reflow_paragraph_lines_joins_wrapped_lines() {
        assertThat(reflower.reflowParagraphLines(List.of(
            "The defendant was convicted of two counts of murder in the first",
            "degree and one count of robbery."
        ))).isEqualTo("The defendant was convicted of two counts of murder in the first degree and one count of robbery.");
    }

    @Test
    void reflow_component_preserves_blank_line_paragraph_breaks() {
        var component = new OpinionComponent(
            OpinionComponentType.MAJORITY,
            OpinionRole.MAJORITY,
            null,
            false,
            List.of(
                new SourceLine(1, "   First wrapped"),
                new SourceLine(2, "line of text."),
                new SourceLine(3, ""),
                new SourceLine(4, "   Second paragraph starts"),
                new SourceLine(5, "here.")
            ),
            1,
            5
        );

        var blocks = reflower.reflowComponent(component);

        assertThat(blocks).hasSize(2);
        assertThat(blocks.get(0).text()).isEqualTo("First wrapped line of text.");
        assertThat(blocks.get(1).text()).isEqualTo("Second paragraph starts here.");
    }

    @Test
    void reflow_opinion_body_respects_subheader_boundaries() {
        var body = new OpinionBody(List.of(
            new OpinionComponent(
                OpinionComponentType.MAJORITY,
                OpinionRole.MAJORITY,
                "Troutman",
                false,
                List.of(
                    new SourceLine(80, "TROUTMAN, J."),
                    new SourceLine(81, "Opening paragraph first"),
                    new SourceLine(82, "line.")
                ),
                80,
                82
            ),
            new OpinionComponent(
                OpinionComponentType.SUBHEADER,
                OpinionRole.SUBHEADER,
                null,
                false,
                List.of(new SourceLine(83, "I.")),
                83,
                83
            ),
            new OpinionComponent(
                OpinionComponentType.MAJORITY,
                OpinionRole.MAJORITY,
                "Troutman",
                false,
                List.of(new SourceLine(84, "New section starts here.")),
                84,
                84
            )
        ));

        var blocks = reflower.reflow(body).blocks();

        assertThat(blocks).extracting(block -> block.type())
            .containsExactly(BlockType.PARAGRAPH, BlockType.SUBHEADER, BlockType.PARAGRAPH);
        assertThat(blocks.get(0).text()).isEqualTo("TROUTMAN, J. Opening paragraph first line.");
        assertThat(blocks.get(1).text()).isEqualTo("I.");
        assertThat(blocks.get(2).text()).isEqualTo("New section starts here.");
    }
}
