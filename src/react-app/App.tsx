import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Treemap, ComposedChart, Line, ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, AreaChart, Area } from 'recharts';
import { Users, Building2, MapPin, Briefcase, TrendingUp, Activity, ChevronDown, Filter, Search, Download, Grid, BarChart3, Eye, EyeOff, Table, RefreshCw, Maximize2, X, ChevronRight, Layers, Database, ArrowRight } from 'lucide-react';
import Papa from 'papaparse';
import _ from 'lodash';

const WCCStaffDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    group: [],
    unit: [],
    location: [],
    title: [],
    minStaff: 0,
    maxStaff: 1000
  });
  const [searchTerms, setSearchTerms] = useState({
    unit: '',
    location: '',
    title: ''
  });
  const [selectedView, setSelectedView] = useState('dashboard');
  const [selectedVisualizations, setSelectedVisualizations] = useState({
    groupPie: true,
    groupBar: true,
    locationMap: true,
    titleCloud: true,
    unitTreemap: true,
    diversityRadar: true,
    sankeyFlow: true,
    timeAnalysis: true
  });
  const [drillDownPath, setDrillDownPath] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [crossFilterActive, setCrossFilterActive] = useState(true);
  const [dataTableSort, setDataTableSort] = useState({ column: 'StaffCount', direction: 'desc' });
  const [dataTablePage, setDataTablePage] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState({});

  // Enhanced color palettes
  const COLORS = {
    primary: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93bbfd', '#dbeafe', '#bfdbfe', '#eff6ff'],
    secondary: ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca'],
    tertiary: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    quaternary: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const files = [
        'BusinessGroups.csv',
        'BusinessUnits.csv',
        'PayLocations.csv',
        'JobTitles.csv',
        'StaffAssignments.csv'
      ];

      const loadedData = {};

      for (const filename of files) {
        try {
          // Fetch CSV files from public/data/ directory
          const response = await fetch(`/data/${filename}`);

          if (!response.ok) {
            throw new Error(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
          }

          const content = await response.text();

          const parsed = Papa.parse(content, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true
          });

          if (parsed.errors && parsed.errors.length > 0) {
            console.warn(`Parsing warnings for ${filename}:`, parsed.errors);
          }

          const cleanedData = parsed.data.map(row => {
            const cleanRow = {};
            Object.keys(row).forEach(key => {
              cleanRow[key.trim()] = row[key];
            });
            return cleanRow;
          });

          loadedData[filename.replace('.csv', '')] = cleanedData;
          console.log(`Loaded ${filename}: ${cleanedData.length} records`);

        } catch (fileError) {
          console.error(`Error loading ${filename}:`, fileError);
          throw fileError;
        }
      }

      const processedData = processData(loadedData);
      setData(processedData);

    } catch (error) {
      console.error('Error loading data:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const processData = (rawData) => {
    const unitMap = _.keyBy(rawData.BusinessUnits, 'UnitID');
    const groupMap = _.keyBy(rawData.BusinessGroups, 'GroupID');
    const locationMap = _.keyBy(rawData.PayLocations, 'LocationID');
    const titleMap = _.keyBy(rawData.JobTitles, 'TitleID');

    const enrichedAssignments = rawData.StaffAssignments.map(a => ({
      ...a,
      UnitName: unitMap[a.UnitID]?.UnitName || 'Unknown',
      GroupID: unitMap[a.UnitID]?.GroupID,
      GroupName: groupMap[unitMap[a.UnitID]?.GroupID]?.GroupName || 'Unknown',
      LocationName: locationMap[a.LocationID]?.LocationName || 'Unknown',
      JobTitle: titleMap[a.TitleID]?.JobTitle || 'Unknown'
    }));

    const totalStaff = _.sumBy(rawData.StaffAssignments, 'StaffCount');

    // Comprehensive aggregations
    const staffByGroup = _.chain(enrichedAssignments)
        .groupBy('GroupName')
        .mapValues(items => _.sumBy(items, 'StaffCount'))
        .toPairs()
        .map(([name, value]) => ({
          name,
          value,
          percentage: (value/totalStaff*100).toFixed(1),
          id: name
        }))
        .sortBy('value')
        .reverse()
        .value();

    const staffByLocation = _.chain(enrichedAssignments)
        .groupBy('LocationName')
        .mapValues(items => _.sumBy(items, 'StaffCount'))
        .toPairs()
        .map(([name, value]) => ({ name, value, id: name }))
        .sortBy('value')
        .reverse()
        .value();

    const staffByTitle = _.chain(enrichedAssignments)
        .groupBy('JobTitle')
        .mapValues(items => _.sumBy(items, 'StaffCount'))
        .toPairs()
        .map(([name, value]) => ({ name, value, id: name }))
        .sortBy('value')
        .reverse()
        .value();

    const staffByUnit = _.chain(enrichedAssignments)
        .groupBy('UnitName')
        .mapValues(items => ({
          value: _.sumBy(items, 'StaffCount'),
          group: items[0].GroupName,
          groupId: items[0].GroupID,
          assignments: items.length
        }))
        .toPairs()
        .map(([name, data]) => ({
          name,
          value: data.value,
          group: data.group,
          groupId: data.groupId,
          assignments: data.assignments,
          id: name
        }))
        .sortBy('value')
        .reverse()
        .value();

    // Hierarchical data for treemap
    const hierarchicalData = _.chain(enrichedAssignments)
        .groupBy('GroupName')
        .map((items, groupName) => ({
          name: groupName,
          children: _.chain(items)
              .groupBy('UnitName')
              .map((unitItems, unitName) => ({
                name: unitName,
                value: _.sumBy(unitItems, 'StaffCount'),
                titles: _.uniqBy(unitItems, 'JobTitle').length
              }))
              .value()
        }))
        .value();

    const diversityByGroup = _.chain(enrichedAssignments)
        .groupBy('GroupName')
        .mapValues(items => ({
          name: items[0].GroupName,
          uniqueTitles: _.uniqBy(items, 'JobTitle').length,
          uniqueLocations: _.uniqBy(items, 'LocationName').length,
          totalStaff: _.sumBy(items, 'StaffCount'),
          avgStaffPerTitle: (_.sumBy(items, 'StaffCount') / _.uniqBy(items, 'JobTitle').length).toFixed(1),
          units: _.uniqBy(items, 'UnitName').length
        }))
        .values()
        .value();

    // Cross-tab analysis
    const crossTab = {
      groupLocation: _.chain(enrichedAssignments)
          .groupBy(a => `${a.GroupName}|${a.LocationName}`)
          .mapValues(items => _.sumBy(items, 'StaffCount'))
          .value(),
      groupTitle: _.chain(enrichedAssignments)
          .groupBy(a => `${a.GroupName}|${a.JobTitle}`)
          .mapValues(items => _.sumBy(items, 'StaffCount'))
          .value()
    };

    return {
      raw: rawData,
      enrichedAssignments,
      staffByGroup,
      staffByLocation,
      staffByTitle,
      staffByUnit,
      hierarchicalData,
      diversityByGroup,
      crossTab,
      totalStaff,
      counts: {
        groups: rawData.BusinessGroups.length,
        units: rawData.BusinessUnits.length,
        locations: rawData.PayLocations.length,
        titles: rawData.JobTitles.length,
        assignments: rawData.StaffAssignments.length
      }
    };
  };

  // Advanced filtering logic
  const filteredData = useMemo(() => {
    if (!data) return null;

    let filtered = [...data.enrichedAssignments];

    // Apply filters
    if (filters.group.length > 0) {
      filtered = filtered.filter(a => filters.group.includes(a.GroupName));
    }
    if (filters.unit.length > 0) {
      filtered = filtered.filter(a => filters.unit.includes(a.UnitName));
    }
    if (filters.location.length > 0) {
      filtered = filtered.filter(a => filters.location.includes(a.LocationName));
    }
    if (filters.title.length > 0) {
      filtered = filtered.filter(a => filters.title.includes(a.JobTitle));
    }

    // Apply search terms
    if (searchTerms.unit) {
      filtered = filtered.filter(a =>
          a.UnitName.toLowerCase().includes(searchTerms.unit.toLowerCase())
      );
    }
    if (searchTerms.location) {
      filtered = filtered.filter(a =>
          a.LocationName.toLowerCase().includes(searchTerms.location.toLowerCase())
      );
    }
    if (searchTerms.title) {
      filtered = filtered.filter(a =>
          a.JobTitle.toLowerCase().includes(searchTerms.title.toLowerCase())
      );
    }

    // Apply staff count range
    filtered = filtered.filter(a =>
        a.StaffCount >= filters.minStaff && a.StaffCount <= filters.maxStaff
    );

    // Recalculate aggregations
    const filteredStaff = _.sumBy(filtered, 'StaffCount');

    const reprocessedData = {
      ...data,
      enrichedAssignments: filtered,
      totalStaff: filteredStaff,
      staffByGroup: _.chain(filtered)
          .groupBy('GroupName')
          .mapValues(items => _.sumBy(items, 'StaffCount'))
          .toPairs()
          .map(([name, value]) => ({
            name,
            value,
            percentage: filteredStaff > 0 ? (value/filteredStaff*100).toFixed(1) : '0',
            id: name
          }))
          .sortBy('value')
          .reverse()
          .value(),
      staffByLocation: _.chain(filtered)
          .groupBy('LocationName')
          .mapValues(items => _.sumBy(items, 'StaffCount'))
          .toPairs()
          .map(([name, value]) => ({ name, value, id: name }))
          .sortBy('value')
          .reverse()
          .value(),
      staffByTitle: _.chain(filtered)
          .groupBy('JobTitle')
          .mapValues(items => _.sumBy(items, 'StaffCount'))
          .toPairs()
          .map(([name, value]) => ({ name, value, id: name }))
          .sortBy('value')
          .reverse()
          .value(),
      staffByUnit: _.chain(filtered)
          .groupBy('UnitName')
          .mapValues(items => ({
            value: _.sumBy(items, 'StaffCount'),
            group: items[0]?.GroupName || 'Unknown',
            groupId: items[0]?.GroupID || 0,
            assignments: items.length
          }))
          .toPairs()
          .map(([name, data]) => ({
            name,
            value: data.value,
            group: data.group,
            groupId: data.groupId,
            assignments: data.assignments,
            id: name
          }))
          .sortBy('value')
          .reverse()
          .value()
    };

    return reprocessedData;
  }, [data, filters, searchTerms]);

  // Cross-filter selection handler
  const handleVisualizationClick = useCallback((type, item) => {
    if (!crossFilterActive || !item) return;

    setSelectedItem({ type, item });

    // Apply cross-filter
    switch(type) {
      case 'group':
        setFilters(prev => ({
          ...prev,
          group: [item.name]
        }));
        break;
      case 'location':
        setFilters(prev => ({
          ...prev,
          location: [item.name]
        }));
        break;
      case 'unit':
        setFilters(prev => ({
          ...prev,
          unit: [item.name]
        }));
        break;
      case 'title':
        setFilters(prev => ({
          ...prev,
          title: [item.name]
        }));
        break;
    }
  }, [crossFilterActive]);

  // Export functionality
  const exportData = useCallback((format) => {
    if (!filteredData) return;

    let content = '';
    const dataToExport = filteredData.enrichedAssignments;

    if (format === 'csv') {
      const csv = Papa.unparse(dataToExport);
      content = csv;
    } else if (format === 'json') {
      content = JSON.stringify(dataToExport, null, 2);
    }

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wcc-staff-data-${new Date().toISOString().split('T')[0]}.${format}`;
    a.click();
  }, [filteredData]);

  const clearFilters = () => {
    setFilters({
      group: [],
      unit: [],
      location: [],
      title: [],
      minStaff: 0,
      maxStaff: 1000
    });
    setSearchTerms({
      unit: '',
      location: '',
      title: ''
    });
    setSelectedItem(null);
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-300 text-lg">Loading Wellington City Council data...</p>
          </div>
        </div>
    );
  }

  if (!data) {
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-center text-red-400">
            <p className="text-xl">Error loading data. Please ensure all CSV files are available in /data/ directory.</p>
          </div>
        </div>
    );
  }

  // Custom Sankey Diagram Component
  const SankeyDiagram = ({ data }) => {
    if (!data || !data.enrichedAssignments) return null;

    // Create Sankey data structure
    const sankeyData = useMemo(() => {
      // Get top entities for visibility
      const topGroups = data.staffByGroup.slice(0, 5);
      const topUnits = data.staffByUnit.slice(0, 15);
      const topLocations = data.staffByLocation.slice(0, 10);

      // Create nodes
      const nodes = [];
      const nodeMap = {};
      let nodeId = 0;

      // Add group nodes
      topGroups.forEach(g => {
        nodes.push({ id: nodeId, name: g.name, type: 'group', value: g.value });
        nodeMap[`group-${g.name}`] = nodeId;
        nodeId++;
      });

      // Add unit nodes
      topUnits.forEach(u => {
        nodes.push({ id: nodeId, name: u.name, type: 'unit', value: u.value });
        nodeMap[`unit-${u.name}`] = nodeId;
        nodeId++;
      });

      // Add location nodes
      topLocations.forEach(l => {
        nodes.push({ id: nodeId, name: l.name, type: 'location', value: l.value });
        nodeMap[`location-${l.name}`] = nodeId;
        nodeId++;
      });

      // Create links
      const links = [];

      // Group to Unit links
      data.enrichedAssignments.forEach(a => {
        const groupKey = `group-${a.GroupName}`;
        const unitKey = `unit-${a.UnitName}`;
        const locationKey = `location-${a.LocationName}`;

        if (nodeMap[groupKey] !== undefined && nodeMap[unitKey] !== undefined) {
          const existingLink = links.find(l =>
              l.source === nodeMap[groupKey] && l.target === nodeMap[unitKey]
          );
          if (existingLink) {
            existingLink.value += a.StaffCount;
          } else {
            links.push({
              source: nodeMap[groupKey],
              target: nodeMap[unitKey],
              value: a.StaffCount
            });
          }
        }

        if (nodeMap[unitKey] !== undefined && nodeMap[locationKey] !== undefined) {
          const existingLink = links.find(l =>
              l.source === nodeMap[unitKey] && l.target === nodeMap[locationKey]
          );
          if (existingLink) {
            existingLink.value += a.StaffCount;
          } else {
            links.push({
              source: nodeMap[unitKey],
              target: nodeMap[locationKey],
              value: a.StaffCount
            });
          }
        }
      });

      return { nodes, links: links.filter(l => l.value > 0) };
    }, [data]);

    return (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Organization Flow (Group → Unit → Location)</h3>
          <div className="bg-gray-900 rounded p-4">
            <div className="space-y-6">
              {/* Group to Unit flows */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Business Groups → Units</h4>
                <div className="space-y-2">
                  {sankeyData.nodes.filter(n => n.type === 'group').map(group => {
                    const groupLinks = sankeyData.links.filter(l => l.source === group.id);
                    return (
                        <div key={group.id} className="bg-gray-800 rounded p-3">
                          <div className="font-medium text-white mb-2">{group.name} ({group.value} staff)</div>
                          <div className="space-y-1">
                            {groupLinks.map((link, idx) => {
                              const targetNode = sankeyData.nodes.find(n => n.id === link.target);
                              if (!targetNode) return null;
                              const percentage = ((link.value / group.value) * 100).toFixed(1);
                              return (
                                  <div key={idx} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center">
                                      <ArrowRight className="h-3 w-3 text-gray-500 mr-2" />
                                      <span className="text-gray-300">{targetNode.name}</span>
                                    </div>
                                    <span className="text-blue-400">{link.value} ({percentage}%)</span>
                                  </div>
                              );
                            })}
                          </div>
                        </div>
                    );
                  })}
                </div>
              </div>

              {/* Unit to Location flows */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Top Units → Locations</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sankeyData.nodes.filter(n => n.type === 'unit').slice(0, 6).map(unit => {
                    const unitLinks = sankeyData.links.filter(l => l.source === unit.id);
                    if (unitLinks.length === 0) return null;
                    return (
                        <div key={unit.id} className="bg-gray-800 rounded p-3">
                          <div className="font-medium text-white mb-2 text-sm">{unit.name}</div>
                          <div className="space-y-1">
                            {unitLinks.slice(0, 3).map((link, idx) => {
                              const targetNode = sankeyData.nodes.find(n => n.id === link.target);
                              if (!targetNode) return null;
                              return (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400 truncate">{targetNode.name}</span>
                                    <span className="text-green-400 ml-2">{link.value}</span>
                                  </div>
                              );
                            })}
                          </div>
                        </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
    );
  };

  // Interactive components
  const MetricCard = ({ icon: Icon, title, value, subtitle, trend, onClick, isSelected }) => (
      <div
          onClick={onClick}
          className={`
        bg-gray-800 rounded-lg p-6 cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/20' : 'hover:shadow-lg hover:bg-gray-750'}
      `}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-400">{title}</p>
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
            {trend && (
                <div className="mt-2 flex items-center">
                  <TrendingUp className={`h-4 w-4 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`} />
                  <span className={`ml-1 text-sm ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {Math.abs(trend)}%
              </span>
                </div>
            )}
          </div>
          <div className="p-3 bg-gray-700 rounded-lg">
            <Icon className="h-6 w-6 text-blue-400" />
          </div>
        </div>
      </div>
  );

  const renderDashboard = () => (
      <div className="space-y-6">
        {/* Key Metrics with Click Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
              icon={Users}
              title="Total Staff"
              value={filteredData.totalStaff.toLocaleString()}
              subtitle={`${data.totalStaff > 0 ? ((filteredData.totalStaff / data.totalStaff) * 100).toFixed(0) : 0}% of total`}
              onClick={() => setSelectedView('data')}
          />
          <MetricCard
              icon={Building2}
              title="Active Groups"
              value={filteredData.staffByGroup.length}
              subtitle={`of ${data.counts.groups} total`}
              onClick={() => setSelectedView('groups')}
          />
          <MetricCard
              icon={MapPin}
              title="Active Locations"
              value={filteredData.staffByLocation.length}
              subtitle={`of ${data.counts.locations} total`}
              onClick={() => setSelectedView('locations')}
          />
          <MetricCard
              icon={Briefcase}
              title="Active Job Titles"
              value={filteredData.staffByTitle.length}
              subtitle={`of ${data.counts.titles} total`}
              onClick={() => setSelectedView('titles')}
          />
        </div>

        {/* Visualization Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interactive Pie Chart */}
          {selectedVisualizations.groupPie && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">Staff Distribution by Group</h3>
                  <button
                      onClick={() => setSelectedVisualizations(prev => ({ ...prev, groupPie: false }))}
                      className="text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                        data={filteredData.staffByGroup}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        onClick={(data) => handleVisualizationClick('group', data)}
                    >
                      {filteredData.staffByGroup.map((entry, index) => (
                          <Cell
                              key={`cell-${index}`}
                              fill={COLORS.primary[index % COLORS.primary.length]}
                              cursor="pointer"
                          />
                      ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                        labelStyle={{ color: '#9ca3af' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
          )}

          {/* Interactive Treemap */}
          {selectedVisualizations.unitTreemap && data.hierarchicalData && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">Business Units Hierarchy</h3>
                  <button
                      onClick={() => setSelectedVisualizations(prev => ({ ...prev, unitTreemap: false }))}
                      className="text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <Treemap
                      data={data.hierarchicalData}
                      dataKey="value"
                      aspectRatio={4/3}
                      stroke="#fff"
                      fill="#8884d8"
                      onClick={(data) => handleVisualizationClick('unit', data)}
                  >
                    <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload[0]) {
                            return (
                                <div className="bg-gray-900 p-3 rounded shadow-lg">
                                  <p className="text-white font-medium">{payload[0].payload.name}</p>
                                  <p className="text-gray-400">Staff: {payload[0].value}</p>
                                  {payload[0].payload.titles && (
                                      <p className="text-gray-400">Titles: {payload[0].payload.titles}</p>
                                  )}
                                </div>
                            );
                          }
                          return null;
                        }}
                    />
                  </Treemap>
                </ResponsiveContainer>
              </div>
          )}
        </div>

        {/* Sankey Diagram */}
        {selectedVisualizations.sankeyFlow && <SankeyDiagram data={filteredData} />}

        {/* Diversity Analysis */}
        {selectedVisualizations.diversityRadar && data.diversityByGroup && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Group Diversity Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={data.diversityByGroup}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: '#9ca3af' }} />
                    <PolarRadiusAxis tick={{ fill: '#9ca3af' }} />
                    <Radar
                        name="Unique Titles"
                        dataKey="uniqueTitles"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.6}
                    />
                    <Radar
                        name="Unique Locations"
                        dataKey="uniqueLocations"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.6}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                        labelStyle={{ color: '#9ca3af' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>

                <div className="space-y-3">
                  {data.diversityByGroup.map((group, idx) => (
                      <div key={group.name} className="bg-gray-700 rounded p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium">{group.name}</span>
                          <span className="text-gray-400">{group.totalStaff} staff</span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Units:</span>
                            <span className="text-white ml-1">{group.units}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Titles:</span>
                            <span className="text-white ml-1">{group.uniqueTitles}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Locations:</span>
                            <span className="text-white ml-1">{group.uniqueLocations}</span>
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            </div>
        )}
      </div>
  );

  const renderDataTable = () => {
    const sortedData = _.orderBy(
        filteredData.enrichedAssignments,
        [dataTableSort.column],
        [dataTableSort.direction]
    );

    const pageSize = 50;
    const pageCount = Math.ceil(sortedData.length / pageSize);
    const paginatedData = sortedData.slice(
        dataTablePage * pageSize,
        (dataTablePage + 1) * pageSize
    );

    return (
        <div className="bg-gray-800 rounded-lg">
          <div className="p-6 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">
                Complete Staff Data ({filteredData.enrichedAssignments.length} records)
              </h3>
              <div className="flex space-x-2">
                <button
                    onClick={() => exportData('csv')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </button>
                <button
                    onClick={() => exportData('json')}
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
              <tr>
                {['GroupName', 'UnitName', 'JobTitle', 'LocationName', 'StaffCount'].map(column => (
                    <th
                        key={column}
                        onClick={() => setDataTableSort(prev => ({
                          column,
                          direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
                        }))}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center">
                        {column.replace(/([A-Z])/g, ' $1').trim()}
                        {dataTableSort.column === column && (
                            <ChevronDown className={`ml-1 h-3 w-3 transform ${dataTableSort.direction === 'asc' ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </th>
                ))}
              </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
              {paginatedData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{row.GroupName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{row.UnitName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{row.JobTitle}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{row.LocationName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">{row.StaffCount}</td>
                  </tr>
              ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-700 flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Showing {dataTablePage * pageSize + 1} to {Math.min((dataTablePage + 1) * pageSize, sortedData.length)} of {sortedData.length} results
            </div>
            <div className="flex space-x-2">
              <button
                  onClick={() => setDataTablePage(0)}
                  disabled={dataTablePage === 0}
                  className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
              >
                First
              </button>
              <button
                  onClick={() => setDataTablePage(prev => Math.max(0, prev - 1))}
                  disabled={dataTablePage === 0}
                  className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-gray-400">
              Page {dataTablePage + 1} of {pageCount}
            </span>
              <button
                  onClick={() => setDataTablePage(prev => Math.min(pageCount - 1, prev + 1))}
                  disabled={dataTablePage === pageCount - 1}
                  className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
              >
                Next
              </button>
              <button
                  onClick={() => setDataTablePage(pageCount - 1)}
                  disabled={dataTablePage === pageCount - 1}
                  className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
              >
                Last
              </button>
            </div>
          </div>
        </div>
    );
  };

  const renderAnalytics = (type) => {
    const getContent = () => {
      switch(type) {
        case 'groups':
          return (
              <div className="space-y-6">
                {/* Comprehensive Group Analysis */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Complete Group Breakdown</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={filteredData.staffByGroup}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" tick={{ fill: '#9ca3af' }} />
                      <YAxis tick={{ fill: '#9ca3af' }} />
                      <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                          labelStyle={{ color: '#9ca3af' }}
                      />
                      <Bar
                          dataKey="value"
                          fill="#3b82f6"
                          onClick={(data) => handleVisualizationClick('group', data)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Group Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredData.staffByGroup.map(group => (
                      <div key={group.name} className="bg-gray-800 rounded-lg p-6">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="text-lg font-semibold text-white">{group.name}</h4>
                          <span className="text-2xl font-bold text-blue-400">{group.value}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Percentage of Total</span>
                            <span className="text-white">{group.percentage}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Units</span>
                            <span className="text-white">
                          {filteredData.staffByUnit.filter(u => u.group === group.name).length}
                        </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Unique Titles</span>
                            <span className="text-white">
                          {_.uniqBy(filteredData.enrichedAssignments.filter(a => a.GroupName === group.name), 'JobTitle').length}
                        </span>
                          </div>
                        </div>
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, group: [group.name] }))}
                            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Filter by this group
                        </button>
                      </div>
                  ))}
                </div>
              </div>
          );

        case 'locations':
          return (
              <div className="space-y-6">
                {/* Location Map/Grid */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">All {filteredData.staffByLocation.length} Locations</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                    {filteredData.staffByLocation.map(location => (
                        <div
                            key={location.name}
                            onClick={() => handleVisualizationClick('location', location)}
                            className="bg-gray-700 rounded p-4 cursor-pointer hover:bg-gray-600 transition-colors"
                        >
                          <p className="text-sm font-medium text-white truncate">{location.name}</p>
                          <p className="text-2xl font-bold text-blue-400">{location.value}</p>
                          <p className="text-xs text-gray-400">staff members</p>
                        </div>
                    ))}
                  </div>
                </div>

                {/* Location Analytics */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Location Distribution Chart</h3>
                  <ResponsiveContainer width="100%" height={600}>
                    <BarChart data={filteredData.staffByLocation} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" tick={{ fill: '#9ca3af' }} />
                      <YAxis dataKey="name" type="category" width={200} tick={{ fill: '#9ca3af' }} />
                      <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                          labelStyle={{ color: '#9ca3af' }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
          );

        case 'titles':
          return (
              <div className="space-y-6">
                {/* Title Search and Filter */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">All {filteredData.staffByTitle.length} Job Titles</h3>
                    <input
                        type="text"
                        placeholder="Search job titles..."
                        value={searchTerms.title}
                        onChange={(e) => setSearchTerms(prev => ({ ...prev, title: e.target.value }))}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Title Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {filteredData.staffByTitle
                        .filter(title =>
                            title.name.toLowerCase().includes(searchTerms.title.toLowerCase())
                        )
                        .map(title => (
                            <div
                                key={title.name}
                                onClick={() => handleVisualizationClick('title', title)}
                                className="bg-gray-700 rounded p-4 cursor-pointer hover:bg-gray-600 transition-colors"
                            >
                              <p className="text-sm font-medium text-white">{title.name}</p>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-2xl font-bold text-blue-400">{title.value}</span>
                                <span className="text-xs text-gray-400">
                            {filteredData.totalStaff > 0 ? ((title.value / filteredData.totalStaff) * 100).toFixed(1) : 0}%
                          </span>
                              </div>
                            </div>
                        ))}
                  </div>
                </div>

                {/* Title Distribution Analysis */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Title Frequency Distribution</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={filteredData.staffByTitle.slice(0, 50)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fill: '#9ca3af' }} />
                      <YAxis tick={{ fill: '#9ca3af' }} />
                      <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                          labelStyle={{ color: '#9ca3af' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
          );

        case 'units':
          return (
              <div className="space-y-6">
                {/* Hierarchical Unit View */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">All {filteredData.staffByUnit.length} Business Units</h3>

                  {/* Group by Business Group */}
                  {Object.entries(_.groupBy(filteredData.staffByUnit, 'group')).map(([groupName, units]) => (
                      <div key={groupName} className="mb-6">
                        <button
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
                            className="flex items-center text-lg font-medium text-blue-400 mb-3 hover:text-blue-300"
                        >
                          <ChevronRight className={`h-5 w-5 mr-2 transform ${expandedGroups[groupName] ? 'rotate-90' : ''}`} />
                          {groupName} ({units.length} units, {_.sumBy(units, 'value')} staff)
                        </button>

                        {expandedGroups[groupName] && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-7">
                              {units.map(unit => (
                                  <div
                                      key={unit.name}
                                      onClick={() => handleVisualizationClick('unit', unit)}
                                      className="bg-gray-700 rounded p-4 cursor-pointer hover:bg-gray-600 transition-colors"
                                  >
                                    <p className="text-sm font-medium text-white">{unit.name}</p>
                                    <div className="flex justify-between items-center mt-2">
                                      <span className="text-xl font-bold text-blue-400">{unit.value}</span>
                                      <span className="text-xs text-gray-400">{unit.assignments} assignments</span>
                                    </div>
                                  </div>
                              ))}
                            </div>
                        )}
                      </div>
                  ))}
                </div>
              </div>
          );

        default:
          return null;
      }
    };

    return getContent();
  };

  return (
      <div className="min-h-screen bg-gray-900">
        {/* Header */}
        <header className="bg-gray-800 shadow-lg border-b border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center">
                  <Database className="h-8 w-8 mr-3 text-blue-500" />
                  Wellington City Council - Staff Analytics Platform
                </h1>
                <p className="text-sm text-gray-400">Comprehensive workforce analysis as of May 2025</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                    onClick={() => setCrossFilterActive(!crossFilterActive)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        crossFilterActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  <Filter className="h-4 w-4 inline mr-2" />
                  Cross-Filter {crossFilterActive ? 'ON' : 'OFF'}
                </button>
                <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        <div className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Business Group</label>
              <select
                  multiple
                  value={filters.group}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    group: Array.from(e.target.selectedOptions, option => option.value)
                  }))}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {data.staffByGroup.map(g => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Search Unit</label>
              <input
                  type="text"
                  value={searchTerms.unit}
                  onChange={(e) => setSearchTerms(prev => ({ ...prev, unit: e.target.value }))}
                  placeholder="Type to search..."
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Search Location</label>
              <input
                  type="text"
                  value={searchTerms.location}
                  onChange={(e) => setSearchTerms(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Type to search..."
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Staff Count Range</label>
              <div className="flex space-x-2">
                <input
                    type="number"
                    value={filters.minStaff}
                    onChange={(e) => setFilters(prev => ({ ...prev, minStaff: parseInt(e.target.value) || 0 }))}
                    className="w-1/2 bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                />
                <input
                    type="number"
                    value={filters.maxStaff}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxStaff: parseInt(e.target.value) || 1000 }))}
                    className="w-1/2 bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                />
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {(filters.group.length > 0 || filters.unit.length > 0 || filters.location.length > 0 || filters.title.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {filters.group.map(g => (
                    <span key={g} className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm flex items-center">
                Group: {g}
                      <button
                          onClick={() => setFilters(prev => ({ ...prev, group: prev.group.filter(x => x !== g) }))}
                          className="ml-2"
                      >
                  <X className="h-3 w-3" />
                </button>
              </span>
                ))}
                {filters.unit.map(u => (
                    <span key={u} className="px-3 py-1 bg-green-600 text-white rounded-full text-sm flex items-center">
                Unit: {u}
                      <button
                          onClick={() => setFilters(prev => ({ ...prev, unit: prev.unit.filter(x => x !== u) }))}
                          className="ml-2"
                      >
                  <X className="h-3 w-3" />
                </button>
              </span>
                ))}
              </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              {[
                { id: 'dashboard', name: 'Interactive Dashboard', icon: Grid },
                { id: 'data', name: 'Full Data Table', icon: Table },
                { id: 'groups', name: 'Groups Analysis', icon: Building2 },
                { id: 'locations', name: 'Locations Analysis', icon: MapPin },
                { id: 'titles', name: 'Titles Analysis', icon: Briefcase },
                { id: 'units', name: 'Units Analysis', icon: Layers }
              ].map((tab) => (
                  <button
                      key={tab.id}
                      onClick={() => setSelectedView(tab.id)}
                      className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${selectedView === tab.id
                          ? 'border-blue-500 text-blue-400'
                          : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'}
                `}
                  >
                    <tab.icon className="h-5 w-5 mr-2" />
                    {tab.name}
                  </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-8">
          {selectedView === 'dashboard' && renderDashboard()}
          {selectedView === 'data' && renderDataTable()}
          {['groups', 'locations', 'titles', 'units'].includes(selectedView) && renderAnalytics(selectedView)}
        </main>

        {/* Footer */}
        <footer className="bg-gray-800 border-t border-gray-700 mt-12">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-400">
                <p>Data source: Wellington City Council Official Information Act Response (IRC-8512)</p>
                <p>Total Records: {data.counts.assignments} assignments across {data.counts.titles} job titles</p>
              </div>
              <div className="text-sm text-gray-400 text-right">
                <p>Last updated: May 2025</p>
                <p>Interactive Analytics Platform v2.0</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
  );
};

export default WCCStaffDashboard;