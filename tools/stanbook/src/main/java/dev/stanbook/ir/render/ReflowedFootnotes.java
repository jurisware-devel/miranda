package dev.stanbook.ir.render;

import java.util.List;
import java.util.Map;

public record ReflowedFootnotes(Map<Integer, List<ReflowedBlock>> blocksByStartLine) {}
