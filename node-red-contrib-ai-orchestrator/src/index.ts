// Side-effect imports ensure Node-RED loads each node file after build.
import './nodes/config/project-config';
import './nodes/config/mongo-memory';
import './nodes/config/role-profile';
import './nodes/role-stage/role-stage';
import './nodes/transition/transition';
import './nodes/memory/memory-read';
import './nodes/memory/memory-write';
import './nodes/handoff/handoff-publish';
import './nodes/handoff/handoff-subscribe';
import './nodes/stage-plan-runner/stage-plan-runner';
import './nodes/human/human-gate';
