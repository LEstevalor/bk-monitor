import { request } from '../base';

export const incidentList = request('POST', 'rest/v2/incident/incident_list/');
export const incidentOverview = request('POST', 'rest/v2/incident/incident_overview/');
export const incidentTopN = request('POST', 'rest/v2/incident/top_n/');
export const incidentValidateQueryString = request('POST', 'rest/v2/incident/validate_query_string/');
export const incidentDetail = request('GET', 'rest/v2/incident/incident_detail/');
export const incidentTopology = request('GET', 'rest/v2/incident/incident_topology/');
export const incidentTimeLine = request('GET', 'rest/v2/incident/incident_time_line/');
export const incidentTargets = request('GET', 'rest/v2/incident/incident_targets/');
export const incidentHandlers = request('GET', 'rest/v2/incident/incident_handlers/');
export const incidentOperations = request('GET', 'rest/v2/incident/incident_operations/');
export const editIncident = request('POST', 'rest/v2/incident/edit_incident/');
export const feedbackIncidentRoot = request('POST', 'rest/v2/incident/feedback_incident_root/');

export default {
  incidentList,
  incidentOverview,
  incidentTopN,
  incidentValidateQueryString,
  incidentDetail,
  incidentTopology,
  incidentTimeLine,
  incidentTargets,
  incidentHandlers,
  incidentOperations,
  editIncident,
  feedbackIncidentRoot
};
