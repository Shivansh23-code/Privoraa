package com.privoraa.usage;

import com.privoraa.auth.PrivoraaUserDetails;
import com.privoraa.usage.dto.UsageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/usage")
@Tag(name = "Usage", description = "Per-user token and request analytics")
public class UsageController {

    private final UsageService service;

    public UsageController(UsageService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Usage dashboard: today, last 7 days, model mix, totals")
    public UsageResponse usage(@AuthenticationPrincipal PrivoraaUserDetails user) {
        return service.getUsage(user.getId());
    }
}
