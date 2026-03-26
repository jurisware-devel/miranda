package dev.stanbook.pipeline;

import dev.stanbook.ir.lowered.LoweredDocument;
import dev.stanbook.ir.render.ReflowedDocument;
import dev.stanbook.ir.render.ReflowedFootnotes;
import dev.stanbook.ir.render.ReflowedOpinion;
import dev.stanbook.ir.source.SourceDocument;
import dev.stanbook.parse.header.HeaderParser;
import dev.stanbook.render.json.MirandaJsonRenderer;
import dev.stanbook.render.json.MirandaJsonRenderer.CanonicalTextDiagnostic;
import dev.stanbook.reflow.FootnoteReflower;
import dev.stanbook.reflow.OpinionReflower;

public final class StanbookPipeline {
    public record RenderedJson(String json, CanonicalTextDiagnostic canonicalTextDiagnostic) {}

    private final HtmlLowerer htmlLowerer;
    private final OpinionReflower opinionReflower;
    private final FootnoteReflower footnoteReflower;
    private final MirandaJsonRenderer mirandaJsonRenderer;

    public StanbookPipeline(
        HtmlLowerer htmlLowerer,
        OpinionReflower opinionReflower,
        FootnoteReflower footnoteReflower,
        MirandaJsonRenderer mirandaJsonRenderer
    ) {
        this.htmlLowerer = htmlLowerer;
        this.opinionReflower = opinionReflower;
        this.footnoteReflower = footnoteReflower;
        this.mirandaJsonRenderer = mirandaJsonRenderer;
    }

    public static StanbookPipeline createDefault() {
        HeaderParser headerParser = new HeaderParser();
        return new StanbookPipeline(
            new HtmlLowerer(headerParser),
            new OpinionReflower(),
            new FootnoteReflower(),
            new MirandaJsonRenderer()
        );
    }

    public LoweredDocument lower(SourceDocument source) {
        if (source.htmlDocument() == null) {
            throw new IllegalArgumentException("Expected HTML-backed SourceDocument");
        }
        return htmlLowerer.lower(source);
    }

    public ReflowedDocument reflow(SourceDocument source) {
        LoweredDocument lowered = lower(source);
        ReflowedOpinion opinion = opinionReflower.reflow(lowered.opinionBody());
        ReflowedFootnotes footnotes = footnoteReflower.reflow(lowered.footnotes());
        return new ReflowedDocument(lowered, opinion, footnotes);
    }

    public String render(SourceDocument source) {
        return mirandaJsonRenderer.render(source, reflow(source));
    }

    public RenderedJson renderWithDiagnostic(SourceDocument source) {
        ReflowedDocument reflowed = reflow(source);
        return new RenderedJson(
            mirandaJsonRenderer.render(source, reflowed),
            mirandaJsonRenderer.diagnoseCanonicalText(source, reflowed)
        );
    }

    public CanonicalTextDiagnostic diagnoseCanonicalText(SourceDocument source) {
        return mirandaJsonRenderer.diagnoseCanonicalText(source, reflow(source));
    }
}
