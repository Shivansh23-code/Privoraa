package com.privoraa.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.privoraa.auth.PrivoraaUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.scheduler.Schedulers;

import java.io.IOException;
import java.util.Map;

/**
 * Local-model catalog + management. Browse curated models by category, see what
 * fits this machine and what's installed, pull/delete via the local Ollama, and
 * pick the active chat model. Pulls stream progress over SSE.
 */
@RestController
@RequestMapping("/api/models")
@Tag(name = "Local models (Ollama)", description = "Browse, download, and select local models")
public class LocalModelController {

    private static final Logger log = LoggerFactory.getLogger(LocalModelController.class);

    private final OllamaCatalogService catalogService;
    private final OllamaModelService ollama;
    private final ActiveModelService activeModel;
    private final EntitlementService entitlements;
    private final ModelDownloadService downloads;

    public LocalModelController(OllamaCatalogService catalogService, OllamaModelService ollama,
                                ActiveModelService activeModel, EntitlementService entitlements,
                                ModelDownloadService downloads) {
        this.catalogService = catalogService;
        this.ollama = ollama;
        this.activeModel = activeModel;
        this.entitlements = entitlements;
        this.downloads = downloads;
    }

    @GetMapping("/catalog")
    @Operation(summary = "Curated catalog by category, annotated with fit + installed + lock flags")
    public CatalogView catalog(@AuthenticationPrincipal PrivoraaUserDetails user) {
        return catalogService.annotate(
                ollama.installedTags(),
                entitlements.planOf(user == null ? null : user.getId()));
    }

    @GetMapping("/installed")
    @Operation(summary = "Models Ollama already has (proxies /api/tags)")
    public JsonNode installed() {
        return ollama.installedRaw();
    }

    @GetMapping("/download")
    @Operation(summary = "Resolve a plan-entitled download URL for a self-hosted GGUF build")
    public DownloadInfo download(@AuthenticationPrincipal PrivoraaUserDetails user,
                                 @RequestParam String tag) {
        return downloads.resolve(user == null ? null : user.getId(), tag);
    }

    @PostMapping("/pull")
    @Operation(summary = "Pull a model; streams {status, completed, total, percent} over SSE")
    public SseEmitter pull(@AuthenticationPrincipal PrivoraaUserDetails user,
                           @RequestBody PullRequest req) {
        SseEmitter emitter = new SseEmitter(0L);
        if (req == null || req.tag() == null || req.tag().isBlank()) {
            send(emitter, "error", Map.of("message", "Missing model tag"));
            emitter.complete();
            return emitter;
        }
        // Entitlement gate: a model above the user's plan can't be downloaded.
        String userId = user == null ? null : user.getId();
        if (!entitlements.canDownload(userId, req.tag())) {
            send(emitter, "error", Map.of(
                    "message", "This model needs the "
                            + entitlements.requiredFor(req.tag()).label() + " plan.",
                    "code", "upgrade_required",
                    "requiredPlan", entitlements.requiredFor(req.tag()).name().toLowerCase()));
            emitter.complete();
            return emitter;
        }
        ollama.pullStream(req.tag())
                .subscribeOn(Schedulers.boundedElastic())
                .subscribe(
                        progress -> send(emitter, "progress", progress),
                        err -> {
                            send(emitter, "error", Map.of("message", err.getMessage()));
                            emitter.complete();
                        },
                        () -> {
                            send(emitter, "done", Map.of("tag", req.tag(), "percent", 100));
                            emitter.complete();
                        });
        return emitter;
    }

    @DeleteMapping("/{tag}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete an installed model to reclaim disk")
    public void delete(@PathVariable String tag) {
        ollama.delete(tag);
    }

    @GetMapping("/active")
    @Operation(summary = "The user's active chat model")
    public Map<String, String> getActive(@AuthenticationPrincipal PrivoraaUserDetails user) {
        return Map.of("active", activeModel.activeFor(user.getId()));
    }

    @PostMapping("/active")
    @Operation(summary = "Set the user's active chat model")
    public Map<String, String> setActive(@AuthenticationPrincipal PrivoraaUserDetails user,
                                         @RequestBody ActiveModelRequest req) {
        if (req == null || req.tag() == null || req.tag().isBlank()) {
            throw new com.privoraa.common.ApiException(HttpStatus.BAD_REQUEST, "Missing model tag");
        }
        return Map.of("active", activeModel.setActive(user.getId(), req.tag()));
    }

    private void send(SseEmitter emitter, String event, Object data) {
        try {
            emitter.send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            log.debug("SSE send failed ({}): {}", event, e.getMessage());
        }
    }

    public record PullRequest(String tag) {}

    public record ActiveModelRequest(String tag) {}
}
