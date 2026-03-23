"""
Attack Trees for Skymap Application Security Analysis
======================================================

This module defines attack trees based on identified vulnerabilities in the
React + Tauri starmap application. Each tree represents a potential attacker
goal and the paths to achieve it.

Based on security vulnerability report: llmdoc/agent/security-vulnerability-report.md
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Set
import json


class NodeType(Enum):
    OR = "or"
    AND = "and"
    LEAF = "leaf"


class Difficulty(Enum):
    TRIVIAL = 1
    LOW = 2
    MEDIUM = 3
    HIGH = 4
    EXPERT = 5


class Cost(Enum):
    FREE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    VERY_HIGH = 4


class DetectionRisk(Enum):
    NONE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CERTAIN = 4


@dataclass
class AttackAttributes:
    difficulty: Difficulty = Difficulty.MEDIUM
    cost: Cost = Cost.MEDIUM
    detection_risk: DetectionRisk = DetectionRisk.MEDIUM
    time_hours: float = 8.0
    requires_insider: bool = False
    requires_physical: bool = False


@dataclass
class AttackNode:
    id: str
    name: str
    description: str
    node_type: NodeType
    attributes: AttackAttributes = field(default_factory=AttackAttributes)
    children: List['AttackNode'] = field(default_factory=list)
    mitigations: List[str] = field(default_factory=list)
    cve_refs: List[str] = field(default_factory=list)
    file_refs: List[str] = field(default_factory=list)

    def add_child(self, child: 'AttackNode') -> None:
        self.children.append(child)


@dataclass
class AttackTree:
    name: str
    description: str
    root: AttackNode
    version: str = "1.0"
    severity: str = "Medium"

    def find_easiest_path(self) -> List[AttackNode]:
        """Find the path with lowest difficulty."""
        return self._find_path(self.root, minimize="difficulty")

    def find_cheapest_path(self) -> List[AttackNode]:
        """Find the path with lowest cost."""
        return self._find_path(self.root, minimize="cost")

    def find_stealthiest_path(self) -> List[AttackNode]:
        """Find the path with lowest detection risk."""
        return self._find_path(self.root, minimize="detection")

    def _find_path(
        self,
        node: AttackNode,
        minimize: str
    ) -> List[AttackNode]:
        """Recursive path finding."""
        if node.node_type == NodeType.LEAF:
            return [node]

        if not node.children:
            return [node]

        if node.node_type == NodeType.OR:
            best_path = None
            best_score = float('inf')

            for child in node.children:
                child_path = self._find_path(child, minimize)
                score = self._path_score(child_path, minimize)
                if score < best_score:
                    best_score = score
                    best_path = child_path

            return [node] + (best_path or [])
        else:  # AND
            path = [node]
            for child in node.children:
                path.extend(self._find_path(child, minimize))
            return path

    def _path_score(self, path: List[AttackNode], metric: str) -> float:
        """Calculate score for a path."""
        if metric == "difficulty":
            return sum(n.attributes.difficulty.value for n in path if n.node_type == NodeType.LEAF)
        elif metric == "cost":
            return sum(n.attributes.cost.value for n in path if n.node_type == NodeType.LEAF)
        elif metric == "detection":
            return sum(n.attributes.detection_risk.value for n in path if n.node_type == NodeType.LEAF)
        return 0

    def get_all_leaf_attacks(self) -> List[AttackNode]:
        """Get all leaf attack nodes."""
        leaves = []
        self._collect_leaves(self.root, leaves)
        return leaves

    def _collect_leaves(self, node: AttackNode, leaves: List[AttackNode]) -> None:
        if node.node_type == NodeType.LEAF:
            leaves.append(node)
        for child in node.children:
            self._collect_leaves(child, leaves)

    def get_unmitigated_attacks(self) -> List[AttackNode]:
        """Find attacks without mitigations."""
        return [n for n in self.get_all_leaf_attacks() if not n.mitigations]

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            "name": self.name,
            "description": self.description,
            "severity": self.severity,
            "version": self.version,
            "root": self._node_to_dict(self.root)
        }

    def _node_to_dict(self, node: AttackNode) -> Dict:
        """Convert node to dictionary."""
        return {
            "id": node.id,
            "name": node.name,
            "description": node.description,
            "type": node.node_type.value,
            "attributes": {
                "difficulty": node.attributes.difficulty.name,
                "cost": node.attributes.cost.name,
                "detection_risk": node.attributes.detection_risk.name,
                "time_hours": node.attributes.time_hours,
            },
            "mitigations": node.mitigations,
            "file_refs": node.file_refs,
            "children": [self._node_to_dict(c) for c in node.children]
        }


class MermaidExporter:
    """Export attack trees to Mermaid diagram format."""

    def __init__(self, tree: AttackTree):
        self.tree = tree
        self._lines: List[str] = []
        self._node_count = 0
        self._node_ids: Dict[str, str] = {}

    def export(self) -> str:
        """Export tree to Mermaid flowchart."""
        self._lines = ["flowchart TD"]
        self._export_node(self.tree.root, None)
        self._add_legend()
        return "\n".join(self._lines)

    def _export_node(self, node: AttackNode, parent_id: Optional[str]) -> str:
        """Recursively export nodes."""
        if node.id in self._node_ids:
            node_id = self._node_ids[node.id]
        else:
            node_id = f"N{self._node_count}"
            self._node_count += 1
            self._node_ids[node.id] = node_id

        # Node shape based on type
        if node.node_type == NodeType.OR:
            shape = f"{node_id}(('{node.name}')"
        elif node.node_type == NodeType.AND:
            shape = f"{node_id}['{node.name}']"
        else:  # LEAF
            style = self._get_leaf_style(node)
            shape = f"{node_id}['{node.name}']"
            self._lines.append(f"    style {node_id} {style}")

        self._lines.append(f"    {shape}")

        if parent_id:
            connector = "-->" if node.node_type != NodeType.AND else "==>"
            self._lines.append(f"    {parent_id} {connector} {node_id}")

        for child in node.children:
            self._export_node(child, node_id)

        return node_id

    def _get_leaf_style(self, node: AttackNode) -> str:
        """Get style based on attack attributes."""
        colors = {
            Difficulty.TRIVIAL: "fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px",
            Difficulty.LOW: "fill:#ffa06b,stroke:#e67700,stroke-width:2px",
            Difficulty.MEDIUM: "fill:#ffd93d,stroke:#fab005,stroke-width:2px",
            Difficulty.HIGH: "fill:#6bcb77,stroke:#2f9e44,stroke-width:2px",
            Difficulty.EXPERT: "fill:#4d96ff,stroke:#1971c2,stroke-width:2px",
        }
        color = colors.get(node.attributes.difficulty, "fill:#gray")
        has_mitigation = "stroke:#51cf66,stroke-width:3px" if node.mitigations else ""
        return color if not has_mitigation else f"fill:#d3f9d8,{has_mitigation}"

    def _add_legend(self):
        """Add legend to diagram."""
        self._lines.append("\n    classDef trivial fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px")
        self._lines.append("    classDef low fill:#ffa06b,stroke:#e67700,stroke-width:2px")
        self._lines.append("    classDef medium fill:#ffd93d,stroke:#fab005,stroke-width:2px")
        self._lines.append("    classDef high fill:#6bcb77,stroke:#2f9e44,stroke-width:2px")
        self._lines.append("    classDef expert fill:#4d96ff,stroke:#1971c2,stroke-width:2px")


def build_complete_system_compromise_tree() -> AttackTree:
    """
    Attack Tree: Complete System Compromise
    ========================================
    Attacker gains full control over the application and underlying system.
    """
    root = AttackNode(
        id="G1",
        name="Complete System Compromise",
        description="Gain full control over the application and underlying system",
        node_type=NodeType.OR
    )

    # Sub-goal: Compromise Frontend
    compromise_frontend = AttackNode(
        id="S1",
        name="Compromise Frontend",
        description="Execute arbitrary code in the frontend context",
        node_type=NodeType.OR
    )

    # Attack 1: XSS via innerHTML
    xss_attack = AttackNode(
        id="A1",
        name="XSS via innerHTML",
        description="Inject malicious script through map location marker data",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.LOW,
            cost=Cost.LOW,
            detection_risk=DetectionRisk.MEDIUM,
            time_hours=2.0
        ),
        mitigations=[
            "Sanitize HTML input",
            "Use React JSX instead of innerHTML",
            "Implement Content Security Policy"
        ],
        file_refs=["components/ui/map-location-picker.tsx:172-178"]
    )

    # Attack 2: Supply Chain Compromise
    supply_chain = AttackNode(
        id="A2",
        name="Supply Chain Compromise",
        description="Compromise a dependency to run malicious code in frontend",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.HIGH,
            cost=Cost.HIGH,
            detection_risk=DetectionRisk.LOW,
            time_hours=40.0
        ),
        mitigations=[
            "Dependency scanning",
            "Software Bill of Materials (SBOM)",
            "Pinned dependencies"
        ],
        file_refs=["package.json"]
    )

    compromise_frontend.add_child(xss_attack)
    compromise_frontend.add_child(supply_chain)

    # Sub-goal: Direct Backend Access
    backend_access = AttackNode(
        id="S2",
        name="Direct Backend Access",
        description="Invoke Tauri commands without authentication",
        node_type=NodeType.AND
    )

    # Step 1: No Authentication Required
    no_auth = AttackNode(
        id="A3",
        name="Exploit No Authentication",
        description="Tauri commands have no permission checks (all 120+ exposed)",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.NONE,
            time_hours=0.5
        ),
        mitigations=[
            "Implement authentication/authorization layer",
            "Add permission checks in Tauri commands",
            "Role-based access control"
        ],
        file_refs=["src-tauri/src/lib.rs:101-244"]
    )

    # Step 2: Call Sensitive Commands
    sensitive_commands = AttackNode(
        id="A4",
        name="Invoke Sensitive Commands",
        description="Call file system, process, or system commands",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.LOW,
            time_hours=1.0
        ),
        mitigations=[
            "Restrict command surface",
            "Sandboxed command execution",
            "Command whitelisting"
        ],
        file_refs=["src-tauri/src/lib.rs"]
    )

    backend_access.add_child(no_auth)
    backend_access.add_child(sensitive_commands)

    # Sub-goal: Path Traversal
    path_traversal = AttackNode(
        id="S3",
        name="Path Traversal Attack",
        description="Access arbitrary files on the system",
        node_type=NodeType.OR
    )

    # Attack 3: Path Traversal via open_path
    path_open = AttackNode(
        id="A5",
        name="Path Traversal via open_path",
        description="Pass arbitrary file paths to open_path command",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.LOW,
            time_hours=1.0
        ),
        mitigations=[
            "Path validation and sanitization",
            "Allowlist of permitted directories",
            "Chroot/jail filesystem access"
        ],
        file_refs=["src-tauri/src/app_settings.rs:246-289"]
    )

    # Attack 4: Path Traversal via import/export
    path_import = AttackNode(
        id="A6",
        name="Path Traversal via import/export",
        description="User-controlled paths in import_all_data/export_all_data",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.LOW,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.LOW,
            time_hours=2.0
        ),
        mitigations=[
            "Validate file paths",
            "Restrict to app data directory",
            "Use secure file dialogs"
        ],
        file_refs=["src-tauri/src/storage.rs:164-267"]
    )

    path_traversal.add_child(path_open)
    path_traversal.add_child(path_import)

    root.add_child(compromise_frontend)
    root.add_child(backend_access)
    root.add_child(path_traversal)

    return AttackTree(
        name="Complete System Compromise",
        description="Attack paths for gaining full system control",
        root=root,
        severity="CRITICAL"
    )


def build_data_exfiltration_tree() -> AttackTree:
    """
    Attack Tree: Data Exfiltration
    ===============================
    Attacker steals sensitive user data from the application.
    """
    root = AttackNode(
        id="G2",
        name="Data Exfiltration",
        description="Steal sensitive user data from the application",
        node_type=NodeType.OR
    )

    # Method 1: Read Files Directly
    read_files = AttackNode(
        id="M1",
        name="Read Files Directly",
        description="Access stored data files through path traversal",
        node_type=NodeType.AND
    )

    step1 = AttackNode(
        id="A7",
        name="Find App Data Directory",
        description="Locate application data storage",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.NONE,
            time_hours=0.5
        ),
        file_refs=["src-tauri/src/storage.rs"]
    )

    step2 = AttackNode(
        id="A8",
        name="Read JSON Files",
        description="Read plaintext JSON storage files",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.LOW,
            time_hours=0.5
        ),
        mitigations=[
            "Encrypt sensitive data at rest",
            "Use system credential storage",
            "File permissions"
        ],
        file_refs=["src-tauri/src/storage.rs:83-98"]
    )

    read_files.add_child(step1)
    read_files.add_child(step2)

    # Method 2: Extract from localStorage
    extract_storage = AttackNode(
        id="M2",
        name="Extract from localStorage",
        description="Access browser localStorage with sensitive data",
        node_type=NodeType.AND
    )

    step3 = AttackNode(
        id="A9",
        name="Execute XSS or DevTools",
        description="Gain JavaScript execution context",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.LOW,
            cost=Cost.LOW,
            detection_risk=DetectionRisk.MEDIUM,
            time_hours=2.0
        ),
        mitigations=[
            "Content Security Policy",
            "XSS prevention",
            "DevTools protection in production"
        ]
    )

    step4 = AttackNode(
        id="A10",
        name="Read localStorage",
        description="Access unencrypted data in localStorage",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.NONE,
            time_hours=0.1
        ),
        mitigations=[
            "Encrypt data before storage",
            "Use secure credential manager",
            "Minimal data in localStorage"
        ],
        file_refs=["lib/storage/web-storage.ts"]
    )

    extract_storage.add_child(step3)
    extract_storage.add_child(step4)

    # Method 3: SSRF to Internal Services
    ssrf = AttackNode(
        id="M3",
        name="SSRF to Internal Services",
        description="Use application to probe internal network",
        node_type=NodeType.AND
    )

    step5 = AttackNode(
        id="A11",
        name="Inject Internal URLs",
        description="Pass internal URLs to prefetch_url or cache fetch",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.LOW,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.MEDIUM,
            time_hours=2.0
        ),
        mitigations=[
            "URL whitelist validation",
            "Block internal/private IPs",
            "Network segmentation"
        ],
        file_refs=[
            "src-tauri/src/unified_cache.rs:332-366",
            "lib/offline/unified-cache.ts:372-425"
        ]
    )

    step6 = AttackNode(
        id="A12",
        name="Exfiltrate Responses",
        description="Capture responses from internal services",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.LOW,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.LOW,
            time_hours=1.0
        ),
        mitigations=[
            "Response validation",
            "Data loss prevention",
            "Network monitoring"
        ]
    )

    ssrf.add_child(step5)
    ssrf.add_child(step6)

    root.add_child(read_files)
    root.add_child(extract_storage)
    root.add_child(ssrf)

    return AttackTree(
        name="Data Exfiltration",
        description="Attack paths for stealing sensitive data",
        root=root,
        severity="CRITICAL"
    )


def build_denial_of_service_tree() -> AttackTree:
    """
    Attack Tree: Denial of Service
    ===============================
    Attacker makes the application unavailable or unresponsive.
    """
    root = AttackNode(
        id="G3",
        name="Denial of Service",
        description="Make the application unavailable or unresponsive",
        node_type=NodeType.OR
    )

    # Method 1: Resource Exhaustion via Large Inputs
    resource_exhaustion = AttackNode(
        id="M4",
        name="Resource Exhaustion",
        description="Exhaust memory or disk space with oversized inputs",
        node_type=NodeType.OR
    )

    attack1 = AttackNode(
        id="A13",
        name="Oversized JSON Deserialization",
        description="Send massive JSON payload to deserialize",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.HIGH,
            time_hours=0.5
        ),
        mitigations=[
            "JSON size limits",
            "Streaming parsers",
            "Memory quotas"
        ],
        file_refs=["src-tauri/src/storage.rs:92"]
    )

    attack2 = AttackNode(
        id="A14",
        name="Cache Flooding",
        description="Fill disk with unlimited cache entries",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.MEDIUM,
            time_hours=1.0
        ),
        mitigations=[
            "Cache size limits",
            "LRU eviction",
            "Disk space monitoring"
        ],
        file_refs=["src-tauri/src/unified_cache.rs:159-200"]
    )

    attack3 = AttackNode(
        id="A15",
        name="Massive CSV Import",
        description="Import enormous CSV file to exhaust resources",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.MEDIUM,
            time_hours=1.0
        ),
        mitigations=[
            "Row count limits",
            "Field size limits",
            "Streaming CSV parser"
        ],
        file_refs=["src-tauri/src/target_io.rs:175-242"]
    )

    resource_exhaustion.add_child(attack1)
    resource_exhaustion.add_child(attack2)
    resource_exhaustion.add_child(attack3)

    # Method 2: API Abuse (No Rate Limiting)
    api_abuse = AttackNode(
        id="M5",
        name="API Abuse",
        description="Flood APIs with requests without rate limiting",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.TRIVIAL,
            cost=Cost.LOW,
            detection_risk=DetectionRisk.HIGH,
            time_hours=0.5
        ),
        mitigations=[
            "Rate limiting on all Tauri commands",
            "Request throttling",
            "Circuit breakers"
        ],
        file_refs=["src-tauri/src/lib.rs"]
    )

    root.add_child(resource_exhaustion)
    root.add_child(api_abuse)

    return AttackTree(
        name="Denial of Service",
        description="Attack paths for making the application unavailable",
        root=root,
        severity="HIGH"
    )


def build_internal_network_recon_tree() -> AttackTree:
    """
    Attack Tree: Internal Network Reconnaissance
    =============================================
    Attacker uses the application to scan and map the internal network.
    """
    root = AttackNode(
        id="G4",
        name="Internal Network Reconnaissance",
        description="Use application to probe internal network and services",
        node_type=NodeType.OR
    )

    # Method 1: SSRF via prefetch_url
    ssrf_method = AttackNode(
        id="M6",
        name="SSRF via URL Injection",
        description="Inject internal URLs into prefetch_url or cache",
        node_type=NodeType.AND
    )

    step1 = AttackNode(
        id="A16",
        name="Enumerate Internal IPs",
        description="Scan internal IP ranges (192.168.x.x, 10.x.x.x)",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.LOW,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.MEDIUM,
            time_hours=4.0
        ),
        mitigations=[
            "Block private IP ranges",
            "URL allowlist only",
            "Network egress filtering"
        ],
        file_refs=[
            "src-tauri/src/unified_cache.rs:332-366",
            "lib/offline/unified-cache.ts:372-425"
        ]
    )

    step2 = AttackNode(
        id="A17",
        name="Port Scan via URLs",
        description="Try different ports to find open services",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.LOW,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.MEDIUM,
            time_hours=4.0
        ),
        mitigations=[
            "Port restrictions",
            "Protocol whitelisting (HTTPS only)",
            "URL validation"
        ]
    )

    step3 = AttackNode(
        id="A18",
        name="Access Cloud Metadata",
        description="Try cloud metadata endpoints (169.254.169.254)",
        node_type=NodeType.LEAF,
        attributes=AttackAttributes(
            difficulty=Difficulty.LOW,
            cost=Cost.FREE,
            detection_risk=DetectionRisk.HIGH,
            time_hours=1.0
        ),
        mitigations=[
            "Block link-local addresses",
            "Cloud metadata endpoint blocking",
            "Network isolation"
        ]
    )

    ssrf_method.add_child(step1)
    ssrf_method.add_child(step2)
    ssrf_method.add_child(step3)

    root.add_child(ssrf_method)

    return AttackTree(
        name="Internal Network Reconnaissance",
        description="Attack paths for scanning internal network via SSRF",
        root=root,
        severity="HIGH"
    )


def generate_all_reports():
    """Generate all attack tree reports."""
    trees = [
        build_complete_system_compromise_tree(),
        build_data_exfiltration_tree(),
        build_denial_of_service_tree(),
        build_internal_network_recon_tree()
    ]

    report = {
        "title": "Skymap Application Security Attack Trees",
        "generated": "2025-12-26",
        "trees": [tree.to_dict() for tree in trees]
    }

    # Generate JSON report
    with open("d:/Project/cobalt-skymap/docs/security/attack-trees-report.json", "w") as f:
        json.dump(report, f, indent=2)

    # Generate Mermaid diagrams
    mermaid_diagrams = []
    for tree in trees:
        exporter = MermaidExporter(tree)
        diagram = exporter.export()
        mermaid_diagrams.append(f"## {tree.name}\n\nSeverity: {tree.severity}\n\n```mermaid\n{diagram}\n```")

    # Generate Markdown report
    md_report = f"""# Skymap Application Security Attack Trees

**Generated:** 2025-12-26
**Based on:** Security Vulnerability Report (llmdoc/agent/security-vulnerability-report.md)

## Executive Summary

This document presents attack tree analysis for the Skymap React + Tauri starmap application.
Attack trees systematically map attacker goals to the paths they can take to achieve them.

**Critical Findings:**
- **4 major attack scenarios** identified
- **19 unique attack paths** documented
- **Most paths are TRIVIAL to LOW difficulty** due to missing security controls
- **Highest risk:** Complete system compromise via unrestricted Tauri command access

## Attack Scenarios

{chr(10).join(mermaid_diagrams)}

## Detailed Analysis

### 1. Complete System Compromise (CRITICAL)

**Easiest Path:** Exploit No Authentication → Invoke Sensitive Commands
- **Difficulty:** TRIVIAL
- **Cost:** FREE
- **Detection Risk:** NONE to LOW
- **Time:** ~1.5 hours

**Impact:** Full filesystem access, remote code execution, complete system control

**Root Causes:**
- All 120+ Tauri commands exposed without permission checks
- Path traversal vulnerabilities in file operations
- No authentication or authorization layer

**Recommended Mitigations:**
1. Implement authentication/authorization layer
2. Add permission checks to all Tauri commands
3. Validate and sanitize all file paths
4. Restrict command surface area
5. Implement sandboxing for sensitive operations

### 2. Data Exfiltration (CRITICAL)

**Easiest Path:** Read Files Directly
- **Difficulty:** TRIVIAL
- **Cost:** FREE
- **Detection Risk:** LOW
- **Time:** ~1 hour

**Impact:** User PII exposure, location history, equipment data, observation logs

**Root Causes:**
- Plaintext data storage (JSON files, localStorage)
- No encryption at rest
- Path traversal allows arbitrary file read
- XSS vulnerabilities enable localStorage theft

**Recommended Mitigations:**
1. Encrypt sensitive data at rest
2. Use system credential storage for secrets
3. Implement Content Security Policy
4. Validate all file paths
5. Add URL allowlist for SSRF prevention

### 3. Denial of Service (HIGH)

**Easiest Path:** Oversized JSON Deserialization
- **Difficulty:** TRIVIAL
- **Cost:** FREE
- **Detection Risk:** HIGH
- **Time:** ~30 minutes

**Impact:** Application crash, system unresponsiveness, disk exhaustion

**Root Causes:**
- No size limits on input data
- Unlimited cache growth
- No rate limiting on commands
- Unbounded CSV parsing

**Recommended Mitigations:**
1. Implement size limits on all inputs
2. Add cache size quotas with LRU eviction
3. Rate limit all Tauri commands
4. Use streaming parsers for large data
5. Add resource monitoring

### 4. Internal Network Reconnaissance (HIGH)

**Easiest Path:** SSRF via URL Injection
- **Difficulty:** LOW
- **Cost:** FREE
- **Detection Risk:** MEDIUM
- **Time:** ~4-8 hours

**Impact:** Internal network mapping, cloud metadata theft, lateral movement

**Root Causes:**
- Arbitrary URL fetching without validation
- No IP address restrictions
- Missing network egress filtering
- No protocol restrictions

**Recommended Mitigations:**
1. Implement URL allowlist validation
2. Block private IP ranges (RFC 1918)
3. Restrict to HTTPS only
4. Add network egress filtering
5. Block cloud metadata endpoints

## Prioritized Remediation Plan

### Phase 1: Critical (Immediate Action Required)

1. **Add Authentication/Authorization** (src-tauri/src/lib.rs)
   - Implement permission checks on all Tauri commands
   - Add role-based access control
   - Audit command surface area

2. **Fix Path Traversal** (app_settings.rs, storage.rs)
   - Validate and sanitize all file paths
   - Implement directory allowlist
   - Use secure file dialogs only

3. **Enable Content Security Policy** (tauri.conf.json)
   - Remove `"csp": null`
   - Implement strict CSP policy
   - Add XSS protections

4. **Encrypt Data at Rest** (storage.rs, web-storage.ts)
   - Use system credential manager
   - Encrypt JSON files
   - Minimize localStorage usage

### Phase 2: High (Within 1 Week)

5. **URL Validation** (unified_cache.rs)
   - Implement URL allowlist
   - Block internal/private IPs
   - Restrict to HTTPS only

6. **Input Size Limits** (all Tauri commands)
   - Add maximum size limits
   - Implement streaming parsers
   - Add resource quotas

7. **Rate Limiting** (lib.rs command handlers)
   - Implement rate limiting on all commands
   - Add throttling mechanisms
   - Circuit breakers for abuse

### Phase 3: Medium (Within 1 Month)

8. **Logging and Monitoring**
   - Add comprehensive audit logs
   - Security event monitoring
   - Alerting on suspicious activities

9. **XSS Prevention** (map-location-picker.tsx)
   - Remove innerHTML usage
   - Use React JSX
   - Sanitize all HTML inputs

10. **Dependency Management**
    - Implement dependency scanning
    - Create SBOM
    - Regular security updates

## Conclusion

The Skymap application has **critical security vulnerabilities** that make system compromise,
data exfiltration, and denial of service attacks trivial to execute. The primary issues are:

1. **No security boundary** between frontend and backend
2. **Missing input validation** across all attack surfaces
3. **Plaintext data storage** without encryption
4. **No authentication or authorization** on sensitive operations

**Immediate action is required** on Phase 1 items to reduce the attack surface from "trivial
exploitation" to "secured application."

## References

- Security Vulnerability Report: `llmdoc/agent/security-vulnerability-report.md`
- MITRE ATT&CK: https://attack.mitre.org/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Tauri Security: https://tauri.app/v1/guides/security/
"""

    with open("d:/Project/cobalt-skymap/docs/security/attack-trees-analysis.md", "w") as f:
        f.write(md_report)

    print("✓ Generated attack-trees-report.json")
    print("✓ Generated attack-trees-analysis.md")
    print("\nSummary:")
    print(f"  - {len(trees)} attack scenarios analyzed")
    print(f"  - {sum(len(t.get_all_leaf_attacks()) for t in trees)} total attack paths identified")
    print(f"  - {sum(len(t.get_unmitigated_attacks()) for t in trees)} unmitigated attacks found")

    return trees


if __name__ == "__main__":
    trees = generate_all_reports()

    # Print easiest paths for each tree
    print("\n" + "="*80)
    print("EASIEST ATTACK PATHS (By Difficulty)")
    print("="*80)

    for tree in trees:
        print(f"\n{tree.name} ({tree.severity}):")
        path = tree.find_easiest_path()
        for node in path:
            if node.node_type == NodeType.LEAF:
                print(f"  → {node.name}")
                print(f"    Difficulty: {node.attributes.difficulty.name}")
                print(f"    Cost: {node.attributes.cost.name}")
                print(f"    Detection: {node.attributes.detection_risk.name}")
                print(f"    Time: {node.attributes.time_hours}h")
                if node.file_refs:
                    print(f"    Files: {', '.join(node.file_refs)}")

